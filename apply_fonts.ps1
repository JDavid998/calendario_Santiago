
$cssPath = "c:\Users\Yeyian PC\Desktop\calendario-interactivo\styles.css"
$content = Get-Content $cssPath -Raw -Encoding UTF8

# 1. Definir @font-face
$fontFaces = @"
@font-face {
    font-family: 'Mewatonia';
    src: url('MEWATONIA.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
}

@font-face {
    font-family: 'Achemost';
    src: url('Achemost.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
}

"@

# 2. Insertar al principio
$newContent = $fontFaces + $content

# 3. Reemplazar font-family en body
$newContent = $newContent -replace "font-family: 'Inter', -apple-system", "font-family: 'Achemost', 'Inter', -apple-system"

# 4. Agregar regla para headers
$headerRule = @"

/* FUENTES PERSONALIZADAS */
h1, h2, h3, h4, h5, h6, .workspace-name, .day-header, .login-header h1, .workspace-selector h1, .header h1, .modal-header h3 {
    font-family: 'Mewatonia', sans-serif;
    letter-spacing: 1px;
}
"@

$newContent += $headerRule

# 5. Guardar
Set-Content -Path $cssPath -Value $newContent -Encoding UTF8
Write-Host "Fuentes configuradas correctamente"
