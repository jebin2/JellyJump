# Renumber Editor Phases from 40-117 to 42-119
# This script renames all editor phase files by adding 2 to their phase number

$editorDir = "c:\Users\jebinwin\Documents\git\gemini_video_platform\project_implementation_guides_for_llm\editor"

# Get all phase files, sorted in descending order (to avoid conflicts)
$files = Get-ChildItem -Path $editorDir -Filter "phase*.md" | Sort-Object Name -Descending

Write-Host "Found $($files.Count) phase files to renumber" -ForegroundColor Cyan
Write-Host ""

foreach ($file in $files) {
    # Extract the phase number from filename
    if ($file.Name -match "phase(\d+)-(.+)\.md") {
        $oldNumber = [int]$matches[1]
        $phaseName = $matches[2]
        $newNumber = $oldNumber + 2
        
        $newFileName = "phase$newNumber-$phaseName.md"
        $newPath = Join-Path $editorDir $newFileName
        
        Write-Host "Renaming: $($file.Name) -> $newFileName" -ForegroundColor Yellow
        Rename-Item -Path $file.FullName -NewName $newFileName
    }
}

Write-Host ""
Write-Host "Renaming complete!" -ForegroundColor Green
Write-Host "Editor phases now range from 42 to 119" -ForegroundColor Green
