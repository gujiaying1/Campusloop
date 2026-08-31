import app from "./app.js";

const port = 3001;

app.listen(port, () => {
  console.log(`CampusLoop backend listening on http://localhost:${port}`);
});
