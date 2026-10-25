import React from 'react'
import { createRoot } from 'react-dom/client'
import { CSSVariablesResolver, MantineColorsTuple, MantineProvider, createTheme } from '@mantine/core'
// App first: the sheet brings Bootstrap's CSS, Mantine's styles must come after it
import App from './App'
import '@mantine/core/styles.css'
import './app.css'

// accent #357ADE (shade 6) for primary buttons, checkboxes and focus; the other shades are its tints and shades
const accent: MantineColorsTuple = [
  '#EBF2FC', '#D3E2F8', '#B2CCF2', '#92B7ED', '#72A2E8',
  '#518DE3', '#357ADE', '#2E69BF', '#2658A0', '#1F4781'
]

// Mantine's greys mapped onto the site palette: secondary bg #F9FAFC, tertiary bg #F2F3F5,
// light lines #E4E9F2, borders #B6C1D5, secondary text #737E8A
const gray: MantineColorsTuple = [
  '#F9FAFC', '#F2F3F5', '#E4E9F2', '#E4E9F2', '#B6C1D5',
  '#B6C1D5', '#737E8A', '#495057', '#343a40', '#212529'
]

const theme = createTheme({ defaultRadius: 'md', primaryColor: 'accent', colors: { accent, gray } })

// light fills of the accent (the level-up button, the active wizard step): tertiary bg with black text
const light = { bg: '#F2F3F5', hover: '#E4E9F2', color: '#000' }
const resolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-accent-light': light.bg,
    '--mantine-color-accent-light-hover': light.hover,
    '--mantine-color-accent-light-color': light.color,
    '--mantine-primary-color-light': light.bg,
    '--mantine-primary-color-light-hover': light.hover,
    '--mantine-primary-color-light-color': light.color,
    // grey text: placeholders and disabled captions use the secondary text colour
    '--mantine-color-placeholder': '#737E8A',
    '--mantine-color-disabled-color': '#737E8A'
  },
  dark: {}
})

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} cssVariablesResolver={resolver}>
      <App />
    </MantineProvider>
  </React.StrictMode>
)
