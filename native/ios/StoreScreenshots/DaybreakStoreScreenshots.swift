import XCTest

/// Read-only capture through the normal UI using a synthetic App Review account.
/// This target is never part of the shipping app or App Store archive.
final class DaybreakStoreScreenshots: XCTestCase {
    func testCaptureLaunchScreens() throws {
        continueAfterFailure = false
        let environment = ProcessInfo.processInfo.environment
        let email = try XCTUnwrap(environment["DAYBREAK_REVIEW_EMAIL"])
        let password = try XCTUnwrap(environment["DAYBREAK_REVIEW_PASSWORD"])
        let app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()

        let emailField = app.webViews.textFields["Account email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 45))
        emailField.tap()
        emailField.typeText(email)
        let passwordField = app.webViews.secureTextFields["Account password"]
        passwordField.tap()
        passwordField.typeText(password)
        app.webViews.buttons["Sign in"].tap()
        XCTAssertTrue(app.webViews.links["Schedule"].firstMatch.waitForExistence(timeout: 45))
        capture(app, "01-today")

        app.webViews.links["Schedule"].firstMatch.tap()
        XCTAssertTrue(app.webViews.staticTexts["Your routine"].waitForExistence(timeout: 30))
        capture(app, "02-schedule")

        app.webViews.links["Health"].firstMatch.tap()
        XCTAssertTrue(app.webViews.staticTexts["Your health at a glance"].waitForExistence(timeout: 30))
        capture(app, "03-health")

        let checkin = app.webViews.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Check-in")).firstMatch
        XCTAssertTrue(checkin.exists)
        checkin.tap()
        capture(app, "04-check-in")

        app.webViews.buttons["Open menu"].tap()
        let preferences = app.webViews.links["Plan preferences"]
        XCTAssertTrue(preferences.waitForExistence(timeout: 10))
        preferences.tap()
        XCTAssertTrue(app.webViews.staticTexts["Plan preferences"].waitForExistence(timeout: 30))
        capture(app, "05-routine")

        app.webViews.buttons["Open menu"].tap()
        app.webViews.links["Settings"].tap()
        XCTAssertTrue(app.webViews.staticTexts["Make Daybreak feel like yours."].waitForExistence(timeout: 30))
        capture(app, "06-settings")
    }

    private func capture(_ app: XCUIApplication, _ name: String) {
        // Allow the app's real transition to finish without altering its UI.
        RunLoop.current.run(until: Date().addingTimeInterval(1.5))
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
