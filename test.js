const options = {
  url: `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}`,
  method: "GET",
  headers: {
    Accept: "application/json",
  },
};
