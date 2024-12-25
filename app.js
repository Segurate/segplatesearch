const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

app.use(express.json()); // Middleware para manejar JSON

// Función para introducir pausas
function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

async function scrapeCarData(plateNumber) {
  let browser;
  try {
    // Lanzar el navegador con Puppeteer
    browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

    const [page] = await browser.pages();

    // Configurar User-Agent y scripts anti-detección
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
    );

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    console.log('Iniciando navegación...');
    await page.goto('https://123seguro.com.ar/seguros/auto/cotizar/0/busqueda-patente', {
      waitUntil: 'networkidle2',
    });
    console.log('Página cargada correctamente.');

    // Manejar el botón "Inicio" si aparece
    try {
      while (true) {
        const button = await page.$('button.css-s0mi8a');
        if (button) {
          console.log('Se detectó el botón "Inicio". Pulsándolo...');
          await button.hover();
          await delay(2000); // Pausa antes del clic
          await button.click();
          await delay(3000); // Pausa después del clic
        } else {
          break;
        }
      }
    } catch (error) {
      console.log('No se detectó el botón "Inicio". Continuando...');
    }

    // Esperar el campo de entrada y simular la interacción
    await page.waitForSelector('#search-by-plate-form-input', { timeout: 60000 });
    console.log('Campo de entrada encontrado.');

    const inputField = await page.$('#search-by-plate-form-input');
    await inputField.click(); // Clic en el campo
    await delay(1000);

    // Borrar cualquier texto existente
    for (let i = 0; i < 10; i++) {
      await inputField.press('Backspace');
      await delay(100);
    }

    // Escribir la patente carácter por carácter con pausas
    for (const char of plateNumber) {
      await inputField.type(char, { delay: Math.floor(Math.random() * 200) + 100 });
    }

    // Pausa antes de enviar el formulario
    await delay(1500);
    await inputField.press('Enter');
    console.log('Formulario enviado.');

    // Esperar a que cargue el contenedor de resultados
    try {
      await page.waitForSelector('.container.conteiner-data-car', { timeout: 60000 });
      console.log('Datos encontrados.');

      const brandModel = await page.$eval('.container.conteiner-data-car h4', (el) => el.innerText);
      const version = await page.$eval('.container.conteiner-data-car span', (el) => el.innerText);

      // Parsear el texto del modelo y el año
      const parts = brandModel.split(' ');
      const year = parts.pop(); // El último elemento es el año
      const brandModelField = parts.join(' '); // Todo lo demás es marca y modelo

      return { 'Marca Modelo': brandModelField, Año: year, Versión: version };
    } catch (error) {
      console.log('No se encontraron los datos del coche.');
      await page.screenshot({ path: 'debug.png' }); // Captura de pantalla para depuración
      return { 'Marca Modelo': 'No encontrado', Año: '', Versión: '' };
    }
  } catch (error) {
    console.error('Error en el scraping:', error);
    return { error: `Error en el scraping: ${error.message}` };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

app.post('/scrape', async (req, res) => {
  const { plate } = req.body;
  if (!plate) {
    return res.status(400).json({ error: 'El campo "plate" es obligatorio' });
  }

  console.log(`Procesando solicitud para la patente: ${plate}`);
  const result = await scrapeCarData(plate);
  res.json(result);
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://127.0.0.1:${PORT}`);
});
