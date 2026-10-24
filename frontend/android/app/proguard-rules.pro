# React Native and each native dependency supply their own consumer rules.
# Avoid broad keep rules: R8 must be able to optimise and obfuscate the release.
# React Native 0.82 registers these classes by name from react_devsupportjni
# whenever InspectorFlags initializes, including production builds. The outer
# connection and DelegateImpl lack class-level DoNotStrip annotations; consumer
# member rules alone let R8 remove them and crash before the first screen loads.
-keep,allowoptimization,includedescriptorclasses class com.facebook.react.devsupport.CxxInspectorPackagerConnection { *; }
-keep,allowoptimization,includedescriptorclasses class com.facebook.react.devsupport.CxxInspectorPackagerConnection$* { *; }

# Preserve source locations for Play Console crash retracing using mapping.txt.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
