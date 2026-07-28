import XCTest

final class DaybreakUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments += [
            "-DAYBREAK_UI_TEST_MODE", "1",
            "-AppleLanguages", "(en)",
            "-AppleLocale", "en_US",
            "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryL"
        ]
        app.launchEnvironment["DAYBREAK_UI_TEST_RUN"] = "1"
        app.launch()
    }

    func testLaunchAndLoginSurface() throws {
        XCTAssertTrue(accountEmail.waitForExistence(timeout: 20))
        XCTAssertTrue(accountPassword.exists)
        XCTAssertTrue(authSubmit.exists)
        attachScreenshot("login-surface")
    }

    func testUncheckedAdultAttestationIsRejectedInUI() throws {
        openSignup()
        XCTAssertTrue(element("signup-adult-attestation").waitForExistence(timeout: 10))
        fillSignupFields()
        element("signup-terms-acceptance").tap()
        element("signup-privacy-acknowledgment").tap()
        authSubmit.tap()
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] %@", "confirm that you are at least 18")).firstMatch.waitForExistence(timeout: 5))
        attachScreenshot("adult-attestation-required")
    }

    func testUnder18PathDoesNotCreateAccount() throws {
        openSignup()
        let under18 = element("signup-under-18")
        XCTAssertTrue(under18.waitForExistence(timeout: 10))
        under18.tap()
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] %@", "No account has been created")).firstMatch.waitForExistence(timeout: 5))
        XCTAssertFalse(accountEmail.exists)
        attachScreenshot("under-18-rejection")
    }

    func testAdultSignupFlowWhenFixtureCredentialsAreProvided() throws {
        let email = try requiredFixture("DAYBREAK_UI_SIGNUP_EMAIL")
        let password = try requiredFixture("DAYBREAK_UI_SIGNUP_PASSWORD")
        openSignup()
        textField("Signup display name").tapAndType("Daybreak UI Test")
        accountEmail.tapAndType(email)
        accountPassword.tapAndType(password)
        element("signup-adult-attestation").tap()
        element("signup-terms-acceptance").tap()
        element("signup-privacy-acknowledgment").tap()
        authSubmit.tap()
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] %@", "Check your email")).firstMatch.waitForExistence(timeout: 15))
        attachScreenshot("adult-signup-submitted")
    }

    func testLoginFlowWhenFixtureCredentialsAreProvided() throws {
        let email = try requiredFixture("DAYBREAK_UI_LOGIN_EMAIL")
        let password = try requiredFixture("DAYBREAK_UI_LOGIN_PASSWORD")
        accountEmail.tapAndType(email)
        accountPassword.tapAndType(password)
        authSubmit.tap()
        XCTAssertTrue(app.webViews.staticTexts["Good morning"].waitForExistence(timeout: 20))
        attachScreenshot("authenticated-dashboard")
    }

    func testAccessibilityAuditOfUnauthenticatedSurface() throws {
        XCTAssertTrue(accountEmail.waitForExistence(timeout: 20))
        if #available(iOS 17.0, *) {
            try app.performAccessibilityAudit(for: [
                .contrast,
                .dynamicType,
                .hitRegion,
                .sufficientElementDescription,
                .textClipped
            ])
        }
    }

    private var accountEmail: XCUIElement { textField("Account email") }
    private var accountPassword: XCUIElement { app.webViews.secureTextFields["Account password"] }
    private var authSubmit: XCUIElement { element("auth-submit") }

    private func openSignup() {
        let create = app.webViews.buttons["Create an account"]
        XCTAssertTrue(create.waitForExistence(timeout: 20))
        create.tap()
    }

    private func fillSignupFields() {
        textField("Signup display name").tapAndType("Daybreak UI Test")
        accountEmail.tapAndType("ui-test@example.invalid")
        accountPassword.tapAndType("Valid-UI-Test-Password-123!")
    }

    private func textField(_ label: String) -> XCUIElement {
        app.webViews.textFields[label]
    }

    private func element(_ identifier: String) -> XCUIElement {
        app.webViews.descendants(matching: .any)[identifier]
    }

    private func requiredFixture(_ name: String) throws -> String {
        guard let value = ProcessInfo.processInfo.environment[name], !value.isEmpty else {
            throw XCTSkip("Fixture environment variable \(name) was not supplied")
        }
        return value
    }

    private func attachScreenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}

private extension XCUIElement {
    func tapAndType(_ value: String) {
        tap()
        typeText(value)
    }
}
