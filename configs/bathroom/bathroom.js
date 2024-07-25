async function fetchConfig() {
  // Get the name of the current script file without the .js extension
    console.log("fetching mirror specific config")
  const scriptName = document.getElementById("clientName").src.split('/').pop().replace('.js', '');
    console.log(scriptName)

  // Construct the URL to the JSON file
  const jsonUrl = `/${scriptName}/${scriptName}.json`;

  // Fetch and parse the JSON file
  try {
    // Fetch and parse the JSON file
    const response = await fetch(jsonUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    return data
  } catch (error) {
    console.error('Error fetching the JSON file:', error);
  }
    console.log("fetched mirror specific log")
}
