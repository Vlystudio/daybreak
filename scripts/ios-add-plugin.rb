#!/usr/bin/env ruby
# Adds the HealthKit plugin files to the App target's "Compile Sources" build
# phase. Copying files into ios/App/App/ is not enough — Capacitor only registers
# a native plugin whose class is compiled into the app binary, which requires a
# file reference in the Xcode project + membership in the target.
#
#   HealthKitPlugin.swift — the plugin implementation (CAPPlugin subclass)
#   HealthKitPlugin.m      — CAP_PLUGIN registration (more reliable than the
#                            pure-Swift auto-discovery, which silently failed)
require "xcodeproj"

project_path = "ios/App/App.xcodeproj"
project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == "App" } or abort("App target not found")
app_group = project.main_group.find_subpath("App", true)

["HealthKitPlugin.swift", "HealthKitPlugin.m"].each do |name|
  already = target.source_build_phase.files.any? do |bf|
    bf.file_ref && bf.file_ref.path.to_s.end_with?(name)
  end
  if already
    puts "#{name} already in App target sources"
  else
    ref = app_group.new_reference(name)
    target.add_file_references([ref])
    puts "Added #{name} to App target sources"
  end
end

project.save

# Verification (visible in the build log) — confirm both files are compiled.
puts "== App target Compile Sources =="
target.source_build_phase.files.each { |bf| puts "  #{bf.file_ref&.path}" }
