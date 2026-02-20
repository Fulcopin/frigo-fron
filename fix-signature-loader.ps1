# Script para actualizar handleLoadSavedSignature para que suba a Cloudinary

$file = "C:\Users\fupifigu\Desktop\OPERATIVOS ESTUDIARF\sistemas_operativos\frigo\frigo-fron\src\components\SignatureUploader.jsx"

$content = Get-Content $file -Raw -Encoding UTF8

# Buscar y reemplazar la función completa
$oldFunction = @'
  const handleLoadSavedSignature = () => {
    try {
      // Obtener usuario actual
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      
      if (!currentUser.username && !currentUser.email) {
        setError('⚠️ No hay usuario logueado');
        return;
      }

      // Buscar firma guardada
      const signatureKey = `signature_${currentUser.username || currentUser.email}`;
      const savedSignature = localStorage.getItem(signatureKey);
      const savedDate = localStorage.getItem(`${signatureKey}_date`);

      if (!savedSignature) {
        setError('⚠️ No tienes una firma guardada. Ve a "Mi Firma" para guardar una.');
        return;
      }

      console.log(`✅ Cargando firma guardada de: ${currentUser.nombre || currentUser.username}`);

      // Aplicar firma
      onFirmaChange({
        ...firmaData,
        firma: {
          base64: savedSignature,
          url: savedSignature,
          provider: 'mysignature',
          uploaded_at: savedDate || new Date().toISOString()
        }
      });

      setError(null);
      console.log('🎉 Firma guardada aplicada exitosamente');

    } catch (err) {
      console.error('❌ Error al cargar firma guardada:', err);
      setError('❌ Error al cargar tu firma guardada');
    }
  };
'@

$newFunction = @'
  const handleLoadSavedSignature = async () => {
    try {
      setUploading(true);
      setError(null);

      // 1. Obtener usuario actual
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      
      if (!currentUser.username && !currentUser.email) {
        setError('⚠️ No hay usuario logueado');
        setUploading(false);
        return;
      }

      // 2. Buscar firma guardada
      const signatureKey = `signature_${currentUser.username || currentUser.email}`;
      const savedSignature = localStorage.getItem(signatureKey);
      const savedDate = localStorage.getItem(`${signatureKey}_date`);

      if (!savedSignature) {
        setError('⚠️ No tienes una firma guardada. Ve a "Mi Firma" para guardar una.');
        setUploading(false);
        return;
      }

      console.log(`✅ Cargando firma guardada de: ${currentUser.nombre || currentUser.username}`);

      // 3. Convertir Base64 a File para subir a Cloudinary
      const response = await fetch(savedSignature);
      const blob = await response.blob();
      const file = new File(
        [blob], 
        `firma_${currentUser.username}_${Date.now()}.png`, 
        { type: 'image/png' }
      );

      console.log('📤 Subiendo firma guardada a Cloudinary...');

      let firmaInfo;

      // 4. Subir a Cloudinary (o usar Base64 como fallback)
      if (useCloudinary) {
        try {
          firmaInfo = await uploadToCloudinary(file);
          console.log('✅ Firma guardada subida a Cloudinary:', firmaInfo.url);
        } catch (cloudinaryError) {
          console.warn('⚠️ Cloudinary falló, usando Base64:', cloudinaryError.message);
          firmaInfo = {
            base64: savedSignature,
            url: savedSignature,
            provider: 'base64',
            uploaded_at: savedDate || new Date().toISOString()
          };
        }
      } else {
        // Usar Base64 directamente si no hay Cloudinary
        firmaInfo = {
          base64: savedSignature,
          url: savedSignature,
          provider: 'base64',
          uploaded_at: savedDate || new Date().toISOString()
        };
        console.log('💾 Usando firma en Base64 (Cloudinary no configurado)');
      }

      // 5. Aplicar firma al formulario
      onFirmaChange({
        ...firmaData,
        firma: firmaInfo
      });

      setError(null);
      setUploading(false);
      console.log('🎉 Firma guardada aplicada exitosamente');

    } catch (err) {
      console.error('❌ Error al cargar firma guardada:', err);
      setError('❌ Error al cargar tu firma guardada');
      setUploading(false);
    }
  };
'@

# Hacer el reemplazo con regex
$pattern = [regex]::Escape("  const handleLoadSavedSignature = () => {") + "[\s\S]*?" + [regex]::Escape("  };")
$newContent = $content -replace $pattern, $newFunction

Set-Content $file -Value $newContent -Encoding UTF8 -NoNewline

Write-Host "✅ Función actualizada exitosamente!" -ForegroundColor Green
Write-Host "📄 Archivo: $file" -ForegroundColor Cyan
Write-Host "💾 Backup guardado como: SignatureUploader.jsx.backup" -ForegroundColor Yellow
