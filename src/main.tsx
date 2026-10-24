import React from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
// App first: the sheet brings Bootstrap's CSS, Mantine's styles must come after it
import App from './App'
import '@mantine/core/styles.css'
import './app.css'

const theme = createTheme({ defaultRadius: 'md', primaryColor: 'dark' })

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <App />
    </MantineProvider>
  </React.StrictMode>
)
