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

        // A fresh install opens the public landing page before login.
        let signInLink = app.webViews.links["Sign in"].firstMatch
        XCTAssertTrue(signInLink.waitForExistence(timeout: 60), "Landing Sign in link did not appear")
        signInLink.tap()

        let emailField = app.webViews.textFields["Account email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 45), "Login email field did not appear")
        emailField.tap()
        emailField.typeText(email)
        // Assert only a boolean: assertion output must never include credentials.
        XCTAssertTrue((emailField.value as? String) == email, "Email entry did not match the configured review account")
        let passwordField = app.webViews.secureTextFields["Account password"]
        XCTAssertTrue(passwordField.waitForExistence(timeout: 15), "Login password field did not appear")
        passwordField.tap()
        passwordField.typeText(password)
        app.webViews.buttons["Sign in"].tap()
        // Cold cloud simulators can be slow. Keep a real navigation assertion,
        // and report only known public UI states if it fails (no field values).
        let reachedNavigation = app.webViews.links["Schedule"].firstMatch.waitForExistence(timeout: 90)
        if !reachedNavigation {
            let knownMessages = [
                "Invalid email or password.",
                "Too many attempts. Please try again later.",
                "Something went wrong. Please try again.",
                "We couldn’t load this page",
            ]
            let visibleMessages = knownMessages.filter { app.webViews.staticTexts[$0].exists }
            let stillPending = app.webViews.buttons["One moment…"].exists
            // Only static UI labels from this synthetic account, never the
            // accessibility debug tree or editable/secure field values.
            let pageText = app.staticTexts.allElementsBoundByIndex.prefix(30).map {
                $0.label.replacingOccurrences(of: email, with: "[review account]")
                    .replacingOccurrences(of: password, with: "[redacted]")
            }.joined(separator: " | ")
            XCTFail("Sign-in did not reach the app navigation; webViews=\(app.webViews.count); alerts=\(app.alerts.count); pending=\(stillPending); known messages=\(visibleMessages.joined(separator: "; ")); page=\(pageText)")
        }
        capture(app, "01-today")

        app.webViews.links["Schedule"].firstMatch.tap()
        // Routine controls live inside a deliberately collapsed details section.
        // Wait for the visible schedule action, without expanding optional tools.
        XCTAssertTrue(app.webViews.buttons["Add"].firstMatch.waitForExistence(timeout: 30), "Schedule Add action did not appear")
        capture(app, "02-schedule")

        app.webViews.links["Health"].firstMatch.tap()
        XCTAssertTrue(app.webViews.staticTexts["Your health at a glance"].waitForExistence(timeout: 30), "Health overview did not appear")
        capture(app, "03-health")

        let checkin = app.webViews.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Check-in")).firstMatch
        XCTAssertTrue(checkin.exists, "Health Check-in control did not appear")
        checkin.tap()
        capture(app, "04-check-in")

        // The header and mobile navigation both expose the same menu action.
        // Use the header match instead of requiring a unique label on phones.
        app.webViews.buttons["Open menu"].firstMatch.tap()
        let preferences = app.webViews.links["Plan preferences"]
        XCTAssertTrue(preferences.waitForExistence(timeout: 10), "Plan preferences menu item did not appear")
        preferences.tap()
        XCTAssertTrue(app.webViews.staticTexts["Plan preferences"].waitForExistence(timeout: 30), "Plan preferences page did not appear")
        capture(app, "05-routine")

        app.webViews.buttons["Open menu"].firstMatch.tap()
        app.webViews.links["Settings"].tap()
        XCTAssertTrue(app.webViews.staticTexts["Make Daybreak feel like yours."].waitForExistence(timeout: 30), "Settings page did not appear")
        capture(app, "06-settings")
    }

    private func capture(_ app: XCUIApplication, _ name: String) {
        // Allow the app's real transition to finish without altering its UI.
        RunLoop.current.run(until: Date().addingTimeInterval(1.5))
        // Capture device pixels, not an app-window crop (compatibility windows
        // can otherwise return dimensions that App Store Connect rejects).
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
