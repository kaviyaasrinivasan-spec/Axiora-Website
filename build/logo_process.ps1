Add-Type -AssemblyName System.Drawing
$src = "C:/Users/abcom/Desktop/office/Workboosterai_WP/source/logo/Final Logo Design (16).png"
$orig = New-Object System.Drawing.Bitmap $src
$ow=$orig.Width; $oh=$orig.Height
Write-Host "orig: $ow x $oh"

# downscale to width 2000 for fast scanning (keeps plenty of detail)
$sw=2000; $sh=[int][math]::Round($oh*$sw/$ow)
$small = New-Object System.Drawing.Bitmap $sw,$sh
$g=[System.Drawing.Graphics]::FromImage($small)
$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::Transparent)
$g.DrawImage($orig,0,0,$sw,$sh)
$g.Dispose()

$rect = New-Object System.Drawing.Rectangle 0,0,$sw,$sh
$data = $small.LockBits($rect,[System.Drawing.Imaging.ImageLockMode]::ReadOnly,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride=$data.Stride
$bytes = New-Object byte[] ($stride*$sh)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0,$bytes,0,$bytes.Length)
$small.UnlockBits($data)

$minX=$sw;$minY=$sh;$maxX=0;$maxY=0
$iconReg=[int]($sw*0.23)
$iMinX=$sw;$iMinY=$sh;$iMaxX=0;$iMaxY=0
for($y=0;$y -lt $sh;$y++){
  $row=$y*$stride
  for($x=0;$x -lt $sw;$x++){
    $a=$bytes[$row+$x*4+3]
    if($a -gt 20){
      if($x -lt $minX){$minX=$x}; if($x -gt $maxX){$maxX=$x}
      if($y -lt $minY){$minY=$y}; if($y -gt $maxY){$maxY=$y}
      if($x -lt $iconReg){
        if($x -lt $iMinX){$iMinX=$x}; if($x -gt $iMaxX){$iMaxX=$x}
        if($y -lt $iMinY){$iMinY=$y}; if($y -gt $iMaxY){$iMaxY=$y}
      }
    }
  }
}
Write-Host "full bbox (small): $minX,$minY .. $maxX,$maxY"
Write-Host "icon bbox (small): $iMinX,$iMinY .. $iMaxX,$iMaxY"

# map bbox back to original coords
$sc=$ow/$sw
$fx=[int]($minX*$sc); $fy=[int]($minY*$sc); $fw=[int](($maxX-$minX+1)*$sc); $fh=[int](($maxY-$minY+1)*$sc)
$ix=[int]($iMinX*$sc); $iy=[int]($iMinY*$sc); $iw=[int](($iMaxX-$iMinX+1)*$sc); $ih=[int](($iMaxY-$iMinY+1)*$sc)

# ---- FULL LOGO: crop to bbox (+small pad), resize to height 300 ----
$padF=[int]($fh*0.06)
$fx=[math]::Max(0,$fx-$padF); $fy=[math]::Max(0,$fy-$padF)
$fw=[math]::Min($ow-$fx,$fw+2*$padF); $fh=[math]::Min($oh-$fy,$fh+2*$padF)
$outH=300; $outW=[int][math]::Round($fw*$outH/$fh)
$logo = New-Object System.Drawing.Bitmap $outW,$outH
$g2=[System.Drawing.Graphics]::FromImage($logo)
$g2.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.Clear([System.Drawing.Color]::Transparent)
$srcR = New-Object System.Drawing.Rectangle $fx,$fy,$fw,$fh
$dstR = New-Object System.Drawing.Rectangle 0,0,$outW,$outH
$g2.DrawImage($orig,$dstR,$srcR,[System.Drawing.GraphicsUnit]::Pixel)
$g2.Dispose()
$logo.Save("C:/Users/abcom/AppData/Local/Temp/claude/c--Users-abcom-Desktop-office-Workboosterai-WP/5e76d591-982f-4e41-80d6-ad9501c72cba/scratchpad/axiora-logo.png",[System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "full logo: $outW x $outH"

# ---- FAVICON: square around icon, pad to square, resize 256 ----
$side=[math]::Max($iw,$ih); $cx=$ix+$iw/2; $cy=$iy+$ih/2
$pad=[int]($side*0.12); $side=$side+2*$pad
$sx=[int]($cx-$side/2); $sy=[int]($cy-$side/2)
$fav = New-Object System.Drawing.Bitmap 256,256
$g3=[System.Drawing.Graphics]::FromImage($fav)
$g3.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g3.Clear([System.Drawing.Color]::Transparent)
$srcS = New-Object System.Drawing.Rectangle $sx,$sy,$side,$side
$dstS = New-Object System.Drawing.Rectangle 0,0,256,256
$g3.DrawImage($orig,$dstS,$srcS,[System.Drawing.GraphicsUnit]::Pixel)
$g3.Dispose()
$fav.Save("C:/Users/abcom/AppData/Local/Temp/claude/c--Users-abcom-Desktop-office-Workboosterai-WP/5e76d591-982f-4e41-80d6-ad9501c72cba/scratchpad/axiora-fav.png",[System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "favicon: 256 x 256 (icon crop $side px)"
$orig.Dispose(); $small.Dispose(); $logo.Dispose(); $fav.Dispose()
Write-Host "DONE"
