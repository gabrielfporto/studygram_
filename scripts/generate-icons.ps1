# Rasterize the existing Studygram monogram. No runtime font or image service required.
Add-Type -AssemblyName System.Drawing
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskIcons = Join-Path $taskRoot 'public/icons'
[IO.Directory]::CreateDirectory($taskIcons) | Out-Null
$taskCulture = [Globalization.CultureInfo]::InvariantCulture
$taskMark = [Drawing.Drawing2D.GraphicsPath]::new()
$taskFont = [Drawing.FontFamily]::new('Segoe UI')
$taskMark.AddString('s', $taskFont, 3, 400, [Drawing.PointF]::new(0, 0), [Drawing.StringFormat]::GenericTypographic)
$taskBounds = $taskMark.GetBounds()
$taskScale = [Math]::Min(260 / $taskBounds.Width, 280 / $taskBounds.Height)
$taskTransform = [Drawing.Drawing2D.Matrix]::new()
$taskTransform.Translate(-$taskBounds.X, -$taskBounds.Y)
$taskMark.Transform($taskTransform)
$taskTransform.Reset()
$taskTransform.Scale($taskScale, $taskScale)
$taskMark.Transform($taskTransform)
$taskBounds = $taskMark.GetBounds()
$taskTransform.Reset()
$taskTransform.Translate((512 - $taskBounds.Width) / 2, (512 - $taskBounds.Height) / 2)
$taskMark.Transform($taskTransform)
$taskPoints = $taskMark.PathPoints
$taskTypes = $taskMark.PathTypes
$taskCommands = [Collections.Generic.List[string]]::new()
function Format-Point($point) { return $point.X.ToString('0.###', $taskCulture) + ' ' + $point.Y.ToString('0.###', $taskCulture) }
for ($taskIndex = 0; $taskIndex -lt $taskPoints.Length; $taskIndex++) {
  $taskType = $taskTypes[$taskIndex] -band 7
  if ($taskType -eq 0) { $taskCommands.Add('M' + (Format-Point $taskPoints[$taskIndex])) }
  elseif ($taskType -eq 1) { $taskCommands.Add('L' + (Format-Point $taskPoints[$taskIndex])) }
  elseif ($taskType -eq 3) {
    $taskCommands.Add('C' + (Format-Point $taskPoints[$taskIndex]) + ' ' + (Format-Point $taskPoints[$taskIndex+1]) + ' ' + (Format-Point $taskPoints[$taskIndex+2]))
    $taskIndex += 2
  }
  if (($taskTypes[$taskIndex] -band 128) -ne 0) { $taskCommands.Add('Z') }
}
$taskPath = $taskCommands -join ' '
$taskSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#a8b2ff"/><path fill="#172033" d="' + $taskPath + '"/></svg>'
[IO.File]::WriteAllText((Join-Path $taskIcons 'favicon.svg'), $taskSvg)
$taskBrush = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#172033'))
function Write-IconPng([int]$size, [string]$name, [bool]$rounded) {
  $taskBitmap = [Drawing.Bitmap]::new(2048, 2048)
  $taskGraphics = [Drawing.Graphics]::FromImage($taskBitmap)
  $taskGraphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $taskGraphics.ScaleTransform(4, 4)
  if ($rounded) {
    $taskBackground = [Drawing.Drawing2D.GraphicsPath]::new()
    $taskBackground.AddArc(0,0,224,224,180,90)
    $taskBackground.AddArc(288,0,224,224,270,90)
    $taskBackground.AddArc(288,288,224,224,0,90)
    $taskBackground.AddArc(0,288,224,224,90,90)
    $taskBackground.CloseFigure()
    $taskBackgroundBrush = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#a8b2ff'))
    $taskGraphics.FillPath($taskBackgroundBrush,$taskBackground)
    $taskBackground.Dispose();$taskBackgroundBrush.Dispose()
  } else { $taskGraphics.Clear([Drawing.ColorTranslator]::FromHtml('#a8b2ff')) }
  $taskGraphics.FillPath($taskBrush,$taskMark)
  $taskOutput = [Drawing.Bitmap]::new($size,$size)
  $taskResizer = [Drawing.Graphics]::FromImage($taskOutput)
  if (-not $rounded) { $taskResizer.Clear([Drawing.ColorTranslator]::FromHtml('#a8b2ff')) }
  $taskResizer.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $taskResizer.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $taskResizer.DrawImage($taskBitmap,0,0,$size,$size)
  $taskOutput.Save((Join-Path $taskIcons $name),[Drawing.Imaging.ImageFormat]::Png)
  $taskResizer.Dispose();$taskOutput.Dispose();$taskGraphics.Dispose();$taskBitmap.Dispose()
}
foreach ($taskSize in @(16,32,48)) { Write-IconPng $taskSize "favicon-$taskSize.png" $true }
Write-IconPng 180 'apple-touch-icon.png' $false
Write-IconPng 192 'icon-192.png' $false
Write-IconPng 512 'icon-512.png' $false
$taskFrames = @(16,32,48) | ForEach-Object { ,([IO.File]::ReadAllBytes((Join-Path $taskIcons "favicon-$_.png"))) }
$taskStream = [IO.File]::Create((Join-Path $taskIcons 'favicon.ico'))
$taskWriter = [IO.BinaryWriter]::new($taskStream)
$taskWriter.Write([uint16]0);$taskWriter.Write([uint16]1);$taskWriter.Write([uint16]3)
$taskOffset = 6 + 16 * 3
for ($taskIndex=0;$taskIndex -lt 3;$taskIndex++) {
  $taskSize = @(16,32,48)[$taskIndex]
  $taskWriter.Write([byte]$taskSize);$taskWriter.Write([byte]$taskSize);$taskWriter.Write([byte]0);$taskWriter.Write([byte]0)
  $taskWriter.Write([uint16]1);$taskWriter.Write([uint16]32);$taskWriter.Write([uint32]$taskFrames[$taskIndex].Length);$taskWriter.Write([uint32]$taskOffset)
  $taskOffset += $taskFrames[$taskIndex].Length
}
foreach ($taskFrame in $taskFrames) { $taskWriter.Write([byte[]]$taskFrame) }
$taskWriter.Dispose();$taskMark.Dispose();$taskTransform.Dispose();$taskFont.Dispose();$taskBrush.Dispose()
Write-Output 'Generated Studygram SVG, ICO and PNG icons.'
