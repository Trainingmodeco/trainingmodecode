One module per source of spoken lines that is built from data. Each exports
`default async () => [{ feature, name, lines }]`, with the lines made by the
app's own builders over every value the screens can produce.
`scripts/spoken-sweeps.mjs` runs them all; `_try.mjs <module>` tries one.
