#!/usr/bin/env ruby
# Installs only the read-only capture target. No auth bypass, signup, deletion,
# source fixture injection or changes to the app's production origin.
require 'fileutils'
require 'json'
require 'xcodeproj'

config = JSON.parse(File.read('ios/App/App/capacitor.config.json'))
abort('Unexpected app origin') unless config.dig('server', 'url') == 'https://daybreak-one.vercel.app'
root = 'ios/App/StoreScreenshots'
FileUtils.mkdir_p(root)
FileUtils.cp('native/ios/StoreScreenshots/DaybreakStoreScreenshots.swift', root)
project = Xcodeproj::Project.open('ios/App/App.xcodeproj')
app = project.targets.find { |target| target.name == 'App' } or abort('App target missing')
target = project.new_target(:ui_test_bundle, 'StoreScreenshots', :ios, '16.0')
target.add_dependency(app)
group = project.main_group.new_group('StoreScreenshots', 'StoreScreenshots')
target.source_build_phase.add_file_reference(group.new_file('DaybreakStoreScreenshots.swift'))
target.build_configurations.each do |configuration|
  configuration.build_settings.merge!({
    'PRODUCT_BUNDLE_IDENTIFIER' => 'app.daybreak.mobile.store-screenshots',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'SWIFT_VERSION' => '5.0',
    'TEST_TARGET_NAME' => 'App',
    'IPHONEOS_DEPLOYMENT_TARGET' => '16.0',
    'TARGETED_DEVICE_FAMILY' => '1,2'
  })
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.set_launch_target(app)
scheme.save_as(project.path, 'StoreScreenshots', true)
puts 'Installed read-only store capture target; release target and origin unchanged.'
