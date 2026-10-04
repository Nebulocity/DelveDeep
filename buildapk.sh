export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export PATH="$JAVA_HOME/bin:$PATH"

# Optional: print version only when a new terminal opens
java -version

# Function to easily trigger your build manually, or leave as bare commands to run immediately
alias build-android="cd android/ && ./gradlew.bat assembleDebug"
