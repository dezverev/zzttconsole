---
name: weather
description: Get current weather for a location using Open-Meteo
---

# Weather

When the user asks for weather at a location, use the `geocode` and `weather` MCP tools:

1. Call `geocode` with the location name to get coordinates
2. Call `weather` with the latitude and longitude to get current conditions

Present the results in a friendly, concise format including:
- Location name and country
- Temperature (with apparent/feels-like)
- Conditions (interpret the WMO weather code)
- Wind speed and direction
- Humidity

## WMO Weather Codes
- 0: Clear sky
- 1-3: Mainly clear, partly cloudy, overcast
- 45, 48: Fog
- 51-55: Drizzle (light, moderate, dense)
- 61-65: Rain (slight, moderate, heavy)
- 71-75: Snow (slight, moderate, heavy)
- 80-82: Rain showers (slight, moderate, violent)
- 85-86: Snow showers
- 95: Thunderstorm
- 96, 99: Thunderstorm with hail
