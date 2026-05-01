KEYS=(
    "/Users/ikerlopezalegre/Downloads/Untitled.jks"
    "/Users/ikerlopezalegre/upload-keystore.jks"
    "/Users/ikerlopezalegre/Desktop/RedCarpet_Fresh/android/app/release.keystore"
    "/Users/ikerlopezalegre/Desktop/RedCarpet_Fresh/android/app/redcarpet_upload.jks"
    "/Users/ikerlopezalegre/Desktop/RedCarpet_Fresh/android/app/Untitled.jks"
)

PASSWORDS=(
    "Escroihuela14*"
    "Escorhuela13*"
    "Escorihuela14!"
    "escorihuela"
    "12345"
    "123456"
    "RedCarpet12345678$"
    "android"
    "release"
    "password"
)

TARGET_SHA1="DD:B2:C5:21:D2:B8:C2:E4:71:BB:95:6F:09:94:32:52:A6:0E:61:8F"

for key in "${KEYS[@]}"; do
    if [ ! -f "$key" ]; then continue; fi
    echo "--- Checking key: $key ---"
    for pass in "${PASSWORDS[@]}"; do
        # echo "Trying password: $pass"
        output=$(keytool -list -v -keystore "$key" -storepass "$pass" 2>/dev/null)
        if [ $? -eq 0 ]; then
            echo "SUCCESS! Password found for $key: $pass"
            sha1=$(echo "$output" | grep "SHA1:" | awk '{print $2}')
            echo "SHA1: $sha1"
            if [ "$sha1" == "$TARGET_SHA1" ]; then
                echo "MATCH FOUND!!! This is the key we need."
                exit 0
            fi
            # Also check if there are multiple entries
            echo "$output" | grep "Alias name:"
        fi
    done
done
