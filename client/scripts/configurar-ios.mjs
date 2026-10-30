// Agrega al Info.plist de iPhone el esquema de URL que necesita «Continuar con Google».
// Uso: node scripts/configurar-ios.mjs 123456-abc.apps.googleusercontent.com
// (el ID de cliente de iOS de Google Cloud; el esquema es ese ID al revés).
import { readFileSync, writeFileSync } from 'node:fs'

const id = process.argv[2]
if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(id ?? '')) {
  console.error('Indica el ID de cliente de iOS, por ejemplo 123-abc.apps.googleusercontent.com')
  process.exit(1)
}
const esquema = id.split('.').reverse().join('.')
const ruta = new URL('../ios/App/App/Info.plist', import.meta.url)
let plist = readFileSync(ruta, 'utf8')
plist = plist.replace(/\s*<key>CFBundleURLTypes<\/key>\s*<array>[\s\S]*?<\/array>/, '')
const bloque = `
	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>${esquema}</string>
			</array>
		</dict>
	</array>`
plist = plist.replace(/<dict>/, `<dict>${bloque}`)
writeFileSync(ruta, plist)
console.log(`Listo: esquema ${esquema} agregado a Info.plist`)
