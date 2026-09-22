#!/usr/bin/env ruby
# Installs the repository-owned UI-test source into a freshly generated
# Capacitor Xcode project. This script is intentionally nonproduction-only.
require 'fileutils'
require 'json'
require 'uri'
require 'xcodeproj'

abort('DAYBREAK_ENABLE_UI_TEST_TARGET=1 is required') unless ENV['DAYBREAK_ENABLE_UI_TEST_TARGET'] == '1'
base_url = ENV.fetch('DAYBREAK_UI_TEST_BASE_URL', '')
uri = URI.parse(base_url) rescue nil
abort('DAYBREAK_UI_TEST_BASE_URL must be an HTTPS nonproduction origin') unless uri&.scheme == 'https' && uri.host
abort('UI tests refuse the production origin') if uri.host == 'daybreak-one.vercel.app'

project_path = 'ios/App/App.xcodeproj'
config_path = 'ios/App/App/capacitor.config.json'
plist_path = 'ios/App/App/Info.plist'
source_root = 'native/ios/UITests'
generated_root = 'ios/App/AppUITests'
[project_path, config_path, plist_path, source_root].each { |item| abort("missing #{item}") unless File.exist?(item) }

config = JSON.parse(File.read(config_path))
config['server'] ||= {}
config['server']['url'] = base_url
config['server']['cleartext'] = false
File.write(config_path, JSON.pretty_generate(config) + "\n")

system('/usr/libexec/PlistBuddy', '-c', 'Delete :WKAppBoundDomains', plist_path, out: File::NULL, err: File::NULL)
abort('could not add test app-bound domains array') unless system('/usr/libexec/PlistBuddy', '-c', 'Add :WKAppBoundDomains array', plist_path)
abort('could not add test app-bound domain') unless system('/usr/libexec/PlistBuddy', '-c', "Add :WKAppBoundDomains:0 string #{uri.host}", plist_path)

FileUtils.mkdir_p(generated_root)
Dir.glob(File.join(source_root, '*.swift')).each { |source| FileUtils.cp(source, generated_root) }

project = Xcodeproj::Project.open(project_path)
app_target = project.targets.find { |target| target.name == 'App' } or abort('App target missing')
test_target = project.targets.find { |target| target.name == 'AppUITests' }
unless test_target
  test_target = project.new_target(:ui_test_bundle, 'AppUITests', :ios, '16.0')
  test_target.add_dependency(app_target)
end
group = project.main_group.find_subpath('AppUITests', true)
Dir.glob(File.join(generated_root, '*.swift')).each do |source|
  relative = File.basename(source)
  reference = group.files.find { |file| file.path == relative } || group.new_file(relative)
  test_target.source_build_phase.add_file_reference(reference, true) unless test_target.source_build_phase.files_references.include?(reference)
end
test_target.build_configurations.each do |configuration|
  configuration.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'app.daybreak.mobile.uitests'
  configuration.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  configuration.build_settings['SWIFT_VERSION'] = '5.0'
  configuration.build_settings['TEST_TARGET_NAME'] = 'App'
  configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
end
project.save

scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app_target)
scheme.add_build_target(test_target)
scheme.add_test_target(test_target)
scheme.set_launch_target(app_target)
scheme.save_as(project.path, 'AppUITests', true)
puts "Installed nonproduction AppUITests target for #{uri.host}"
