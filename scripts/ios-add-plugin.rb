#!/usr/bin/env ruby
# Adds HealthKitPlugin.swift to the App target's "Compile Sources" build phase.
# Copying the file into ios/App/App/ is not enough — Capacitor only registers a
# native plugin if its class is actually compiled into the app binary, which
# requires a file reference in the Xcode project + membership in the target.
require "xcodeproj"

project_path = "ios/App/App.xcodeproj"
project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == "App" } or abort("App target not found")

already = target.source_build_phase.files.any? do |bf|
  bf.file_ref && bf.file_ref.path.to_s.end_with?("HealthKitPlugin.swift")
end

if already
  puts "HealthKitPlugin.swift already in App target sources"
else
  app_group = project.main_group.find_subpath("App", true)
  ref = app_group.new_reference("HealthKitPlugin.swift")
  target.add_file_references([ref])
  project.save
  puts "Added HealthKitPlugin.swift to App target sources"
end
