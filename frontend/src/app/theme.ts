import {
  Badge,
  Button,
  Card,
  createTheme,
  type MantineColorsTuple,
  NavLink,
  Table,
} from '@mantine/core'

/**
 * Brand colour: a clinical teal. Calm and legible, and clearly distinct from
 * the red, amber and green reserved for patient status.
 * Shade 7 is the primary; it passes WCAG AA against white text.
 */
const brand: MantineColorsTuple = [
  '#e8f6f6',
  '#d2eaea',
  '#a7d3d4',
  '#78bcbd',
  '#52a8aa',
  '#3a9c9e',
  '#2b9698',
  '#147d80',
  '#0d6b6e',
  '#035a5d',
]

/** Cool grey with a hint of the brand hue, so neutrals sit comfortably beside it. */
const slate: MantineColorsTuple = [
  '#f5f8f9',
  '#e9eef0',
  '#d5dde1',
  '#b9c5cb',
  '#93a3ab',
  '#72848e',
  '#586a74',
  '#43535c',
  '#2f3c43',
  '#1c262b',
]

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 7, dark: 5 },
  colors: { brand, gray: slate },
  autoContrast: true,

  fontFamily: "'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif",
  headings: {
    fontFamily: "'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontWeight: '650',
  },
  defaultRadius: 'md',

  components: {
    Badge: Badge.extend({ defaultProps: { variant: 'light', radius: 'sm' } }),
    Button: Button.extend({ defaultProps: { fw: 600 } }),
    Card: Card.extend({ defaultProps: { withBorder: true, radius: 'lg', padding: 'lg' } }),
    NavLink: NavLink.extend({ defaultProps: { fw: 500 }, styles: { root: { borderRadius: 8 } } }),
    Table: Table.extend({ defaultProps: { verticalSpacing: 'sm', horizontalSpacing: 'md' } }),
  },
})
