// Shared presentation formatters.
// Currency is rendered in a fixed en-US USD format so evidence identifiers and
// thresholds stay byte-identical across interface languages.
// MIT License

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function formatUsd(amount: number): string {
  return USD.format(amount)
}
