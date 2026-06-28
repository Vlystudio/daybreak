#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>
// Generated header exposing the @objc Swift HealthKitPlugin class to this
// Objective-C file (the App target's product module name is "App").
#import "App-Swift.h"

// Registers the Swift HealthKitPlugin with Capacitor's bridge under the JS name
// "HealthKit" (matches registerPlugin("HealthKit") in healthkit.client.ts).
// This explicit CAP_PLUGIN registration is more reliable than the pure-Swift
// CAPBridgedPlugin auto-discovery for plugins compiled into the app target, and
// it keeps the class from being dead-stripped by the linker.
CAP_PLUGIN(HealthKitPlugin, "HealthKit",
    CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestAuthorization, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(queryDailyQuantity, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(querySleep, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(queryWorkouts, CAPPluginReturnPromise);
)
