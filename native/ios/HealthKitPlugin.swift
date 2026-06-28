import Foundation
import Capacitor
import HealthKit

/**
 * Native HealthKit plugin for the Daybreak iOS shell.
 *
 * JS name "HealthKit" — matches registerPlugin<HealthKitPlugin>("HealthKit") in
 * src/lib/integrations/apple-health/healthkit.client.ts.
 *
 * Quantity data is returned as DAILY aggregates (HKStatisticsCollectionQuery) so
 * a multi-year first sync stays bounded (days × types) instead of shipping
 * millions of raw samples. Sleep and workouts come back as discrete samples.
 *
 * Registered with Capacitor via the companion HealthKitPlugin.m (CAP_PLUGIN
 * macro) — the pure-Swift CAPBridgedPlugin auto-discovery doesn't reliably find
 * app-target plugins, so we register explicitly. Both files must be in the app
 * target. Requires the HealthKit capability + Info.plist usage strings
 * (see docs/apple-health-phase-2.md).
 */
@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin {
    private let store = HKHealthStore()

    private lazy var dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.calendar = Calendar.current
        f.timeZone = TimeZone.current
        return f
    }()
    private let iso = ISO8601DateFormatter()

    // MARK: - Availability & authorization

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit is not available on this device"); return
        }
        let ids = call.getArray("read", String.self) ?? []
        var types = Set<HKObjectType>()
        for id in ids { if let t = objectType(for: id) { types.insert(t) } }
        store.requestAuthorization(toShare: nil, read: types) { granted, err in
            if let err = err { call.reject(err.localizedDescription); return }
            call.resolve(["granted": granted])
        }
    }

    // MARK: - Daily quantity aggregates

    @objc func queryDailyQuantity(_ call: CAPPluginCall) {
        guard let id = call.getString("type"),
              let qType = HKQuantityType.quantityType(forIdentifier: HKQuantityTypeIdentifier(rawValue: id)) else {
            call.reject("Unknown quantity type"); return
        }
        guard let start = day(call.getString("startDate")), let end = day(call.getString("endDate")) else {
            call.reject("Bad date range"); return
        }

        let cumulative = qType.aggregationStyle == .cumulative
        let options: HKStatisticsOptions = cumulative ? .cumulativeSum : .discreteAverage
        var anchor = Calendar.current.startOfDay(for: start)
        let predicate = HKQuery.predicateForSamples(withStart: anchor, end: end, options: .strictStartDate)
        let interval = DateComponents(day: 1)
        let unit = canonicalUnit(for: qType)

        let q = HKStatisticsCollectionQuery(quantityType: qType, quantitySamplePredicate: predicate,
                                            options: options, anchorDate: anchor, intervalComponents: interval)
        q.initialResultsHandler = { [weak self] _, collection, err in
            guard let self = self else { return }
            if let err = err { call.reject(err.localizedDescription); return }
            var points: [[String: Any]] = []
            collection?.enumerateStatistics(from: anchor, to: end) { stat, _ in
                let qty = cumulative ? stat.sumQuantity() : stat.averageQuantity()
                if let qty = qty {
                    points.append([
                        "date": self.dayFormatter.string(from: stat.startDate),
                        "value": qty.doubleValue(for: unit),
                        "unit": unit.unitString
                    ])
                }
            }
            call.resolve(["points": points])
        }
        _ = anchor // silence unused warning when cumulative path differs
        store.execute(q)
    }

    // MARK: - Sleep

    @objc func querySleep(_ call: CAPPluginCall) {
        guard let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) else {
            call.reject("No sleep type"); return
        }
        guard let start = day(call.getString("startDate")), let end = day(call.getString("endDate")) else {
            call.reject("Bad date range"); return
        }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let q = HKSampleQuery(sampleType: sleepType, predicate: predicate, limit: HKObjectQueryNoLimit,
                              sortDescriptors: nil) { [weak self] _, samples, err in
            guard let self = self else { return }
            if let err = err { call.reject(err.localizedDescription); return }
            let out: [[String: Any]] = (samples as? [HKCategorySample] ?? []).map {
                [
                    "value": self.sleepValueString($0.value),
                    "startDate": self.iso.string(from: $0.startDate),
                    "endDate": self.iso.string(from: $0.endDate)
                ]
            }
            call.resolve(["samples": out])
        }
        store.execute(q)
    }

    // MARK: - Workouts

    @objc func queryWorkouts(_ call: CAPPluginCall) {
        guard let start = day(call.getString("startDate")), let end = day(call.getString("endDate")) else {
            call.reject("Bad date range"); return
        }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let q = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predicate,
                              limit: HKObjectQueryNoLimit, sortDescriptors: nil) { [weak self] _, samples, err in
            guard let self = self else { return }
            if let err = err { call.reject(err.localizedDescription); return }
            let workouts = (samples as? [HKWorkout] ?? [])
            let out: [[String: Any]] = workouts.map { w in
                var dict: [String: Any] = [
                    "activityType": self.workoutName(w.workoutActivityType),
                    "startDate": self.iso.string(from: w.startDate),
                    "endDate": self.iso.string(from: w.endDate),
                    "durationSec": Int(w.duration)
                ]
                if let d = w.totalDistance?.doubleValue(for: .meter()) { dict["distanceM"] = d }
                if let e = w.totalEnergyBurned?.doubleValue(for: .kilocalorie()) { dict["activeEnergyKcal"] = e }
                // Heart-rate stats (iOS 16+ statistics API), best-effort.
                if #available(iOS 16.0, *), let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate),
                   let stats = w.statistics(for: hrType) {
                    let bpm = HKUnit.count().unitDivided(by: .minute())
                    if let avg = stats.averageQuantity()?.doubleValue(for: bpm) { dict["avgHr"] = avg }
                    if let mx = stats.maximumQuantity()?.doubleValue(for: bpm) { dict["maxHr"] = mx }
                }
                return dict
            }
            call.resolve(["workouts": out])
        }
        store.execute(q)
    }

    // MARK: - Helpers

    private func day(_ s: String?) -> Date? {
        guard let s = s else { return nil }
        if let d = dayFormatter.date(from: s) { return d }
        return iso.date(from: s)
    }

    private func objectType(for id: String) -> HKObjectType? {
        if id == "HKCategoryTypeIdentifierSleepAnalysis" {
            return HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)
        }
        if id == "HKWorkoutTypeIdentifier" { return HKObjectType.workoutType() }
        return HKQuantityType.quantityType(forIdentifier: HKQuantityTypeIdentifier(rawValue: id))
    }

    private func canonicalUnit(for t: HKQuantityType) -> HKUnit {
        switch t.identifier {
        case HKQuantityTypeIdentifier.stepCount.rawValue,
             HKQuantityTypeIdentifier.flightsClimbed.rawValue:
            return .count()
        case HKQuantityTypeIdentifier.distanceWalkingRunning.rawValue:
            return .meter()
        case HKQuantityTypeIdentifier.activeEnergyBurned.rawValue,
             HKQuantityTypeIdentifier.basalEnergyBurned.rawValue:
            return .kilocalorie()
        case HKQuantityTypeIdentifier.heartRate.rawValue,
             HKQuantityTypeIdentifier.restingHeartRate.rawValue,
             HKQuantityTypeIdentifier.respiratoryRate.rawValue,
             HKQuantityTypeIdentifier.walkingHeartRateAverage.rawValue:
            return HKUnit.count().unitDivided(by: .minute())
        case HKQuantityTypeIdentifier.heartRateVariabilitySDNN.rawValue:
            return .secondUnit(with: .milli)
        case HKQuantityTypeIdentifier.oxygenSaturation.rawValue,
             HKQuantityTypeIdentifier.bodyFatPercentage.rawValue:
            return .percent()
        case HKQuantityTypeIdentifier.bodyMass.rawValue:
            return .gramUnit(with: .kilo)
        case HKQuantityTypeIdentifier.bodyTemperature.rawValue:
            return .degreeCelsius()
        case HKQuantityTypeIdentifier.vo2Max.rawValue:
            return HKUnit(from: "ml/kg*min")
        case HKQuantityTypeIdentifier.bloodGlucose.rawValue:
            return HKUnit(from: "mg/dL")
        case HKQuantityTypeIdentifier.bloodPressureSystolic.rawValue,
             HKQuantityTypeIdentifier.bloodPressureDiastolic.rawValue:
            return .millimeterOfMercury()
        case HKQuantityTypeIdentifier.appleExerciseTime.rawValue,
             HKQuantityTypeIdentifier.appleStandTime.rawValue:
            return .minute()
        default:
            return .count()
        }
    }

    private func sleepValueString(_ v: Int) -> String {
        switch v {
        case HKCategoryValueSleepAnalysis.inBed.rawValue: return "HKCategoryValueSleepAnalysisInBed"
        case HKCategoryValueSleepAnalysis.awake.rawValue: return "HKCategoryValueSleepAnalysisAwake"
        default: break
        }
        if #available(iOS 16.0, *) {
            switch v {
            case HKCategoryValueSleepAnalysis.asleepCore.rawValue: return "HKCategoryValueSleepAnalysisAsleepCore"
            case HKCategoryValueSleepAnalysis.asleepDeep.rawValue: return "HKCategoryValueSleepAnalysisAsleepDeep"
            case HKCategoryValueSleepAnalysis.asleepREM.rawValue: return "HKCategoryValueSleepAnalysisAsleepREM"
            case HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue: return "HKCategoryValueSleepAnalysisAsleepUnspecified"
            default: break
            }
        }
        return "HKCategoryValueSleepAnalysisAsleepUnspecified"
    }

    private func workoutName(_ t: HKWorkoutActivityType) -> String {
        switch t {
        case .running: return "Running"
        case .walking: return "Walking"
        case .cycling: return "Cycling"
        case .swimming: return "Swimming"
        case .hiking: return "Hiking"
        case .yoga: return "Yoga"
        case .functionalStrengthTraining, .traditionalStrengthTraining: return "StrengthTraining"
        case .highIntensityIntervalTraining: return "HIIT"
        case .elliptical: return "Elliptical"
        case .rowing: return "Rowing"
        case .coreTraining: return "CoreTraining"
        case .dance, .cardioDance: return "Dance"
        case .pilates: return "Pilates"
        default: return "Other"
        }
    }
}
