import * as React from "react"

type CountryApiResponse = {
  name?: {
    common?: string
  }
}

const DEFAULT_COUNTRY = "Nigeria"
const COUNTRY_API_URL = "https://restcountries.com/v3.1/all?fields=name"

export function useCountryOptions(fallbackCountry = DEFAULT_COUNTRY) {
  const initialCountry = fallbackCountry.trim() || DEFAULT_COUNTRY
  const [countryOptions, setCountryOptions] = React.useState<string[]>([initialCountry])
  const [countriesLoading, setCountriesLoading] = React.useState(true)
  const [countryLookupFailed, setCountryLookupFailed] = React.useState(false)

  React.useEffect(() => {
    const controller = new AbortController()

    const loadCountries = async () => {
      setCountriesLoading(true)
      setCountryLookupFailed(false)

      try {
        const response = await fetch(COUNTRY_API_URL, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Country request failed with status ${response.status}`)
        }

        const data = (await response.json()) as CountryApiResponse[]
        const countries = Array.from(
          new Set(data.map((country) => country.name?.common?.trim()).filter((countryName): countryName is string => Boolean(countryName))),
        ).sort((left, right) => left.localeCompare(right))

        if (countries.length === 0) {
          throw new Error("Country list is empty")
        }

        setCountryOptions(countries.includes(initialCountry) ? countries : [initialCountry, ...countries])
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return
        }

        setCountryLookupFailed(true)
      } finally {
        if (!controller.signal.aborted) {
          setCountriesLoading(false)
        }
      }
    }

    void loadCountries()

    return () => {
      controller.abort()
    }
  }, [initialCountry])

  return { countryOptions, countriesLoading, countryLookupFailed }
}
