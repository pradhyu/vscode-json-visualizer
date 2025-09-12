# Debugging Timeline Extension Issue

## The Problem
You're seeing only rxTba entries (red bars) in the timeline, but your JSON file contains rxHistory and medHistory data as well.

## Most Likely Causes & Solutions

### 1. **File Not Saved** (Most Common)
The extension reads from the saved file, not from the editor buffer.
- **Solution**: Press `Ctrl+S` (or `Cmd+S` on Mac) to save your JSON file, then try the timeline command again.

### 2. **Wrong File Selected**
The extension might be reading a different file than what you have open.
- **Solution**: Right-click directly on your JSON file in the Explorer panel and select "View Medical Claims Timeline"
- Or: Make sure your JSON file is the active tab, then use `Ctrl+Shift+P` → "Medical Claims Timeline: View Timeline"

### 3. **Check Console for Errors**
There might be parsing errors that are causing fallback to a limited parser.
- **Solution**: 
  1. Open Developer Tools: `Help` → `Toggle Developer Tools`
  2. Go to the `Console` tab
  3. Run the timeline command again
  4. Look for any red error messages

### 4. **Run Diagnostic Command**
Use the built-in diagnostic to check what's happening:
- **Solution**: 
  1. Right-click on your JSON file
  2. Select "Medical Claims Timeline: Run Diagnostic"
  3. This will show you exactly what data is being parsed

### 5. **Verify JSON Structure**
Make sure your JSON has the expected structure:
```json
{
  "rxTba": [...],      // Prescription claims (red bars)
  "rxHistory": [...],  // Prescription history (teal bars)  
  "medHistory": {      // Medical claims (blue bars)
    "claims": [...]
  }
}
```

## Quick Test
1. Save your file (`Ctrl+S`)
2. Right-click on the file in Explorer
3. Select "Medical Claims Timeline: Run Diagnostic"
4. Check the output - it should show all three claim types

## Expected Result
You should see:
- **Red bars**: rxTba claims
- **Teal/Cyan bars**: rxHistory claims  
- **Blue bars**: medHistory claims

If you're still only seeing red bars after trying these steps, please share the console output from the diagnostic command.