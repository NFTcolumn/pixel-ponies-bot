#!/bin/bash

echo "🔄 Updating model imports from MongoDB to SQLite..."

# Array of files to update
files=(
  "src/handlers/commands/registrationHandler.js"
  "src/handlers/schedulerHandler.js"
  "src/services/PayoutService.js"
  "src/handlers/commands/infoHandler.js"
  "src/handlers/commands/raceHandler.js"
  "src/services/RaceService.js"
  "src/services/ReferralService.js"
  "src/handlers/commands/adminHandler.js"
  "src/utils/dataIntegrity.js"
)

# Update each file
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "   Updating $file"
    sed -i.bak "s|from '../models/User.js'|from '../models/User.sqlite.js'|g" "$file"
    sed -i.bak "s|from '../models/Race.js'|from '../models/Race.sqlite.js'|g" "$file"
    sed -i.bak "s|from '../models/TempSelection.js'|from '../models/TempSelection.sqlite.js'|g" "$file"
    sed -i.bak "s|from '../../models/User.js'|from '../../models/User.sqlite.js'|g" "$file"
    sed -i.bak "s|from '../../models/Race.js'|from '../../models/Race.sqlite.js'|g" "$file"
    sed -i.bak "s|from '../../models/TempSelection.js'|from '../../models/TempSelection.sqlite.js'|g" "$file"
    rm "${file}.bak"
  fi
done

echo "✅ Model imports updated!"
