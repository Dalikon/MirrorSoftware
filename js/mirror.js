async function fetchConfig(name = "") {
    // Get the name of the current script file without the .js extension
    const clientName = document.getElementById("clientName").src.split('/').pop().replace('.js', '');
    if (name === "") {
        console.log("Fetching mirror specific config")
        // Construct the URL to the JSON file
        const jsonUrl = `/${clientName}/${scriptName}.json`;
    } else {
        console.log(`Fetching user config: ${name}.json`)
        const userName = name;
        const jsonUrl = `/${clientName}/users/${userName}.json`;
    }

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
