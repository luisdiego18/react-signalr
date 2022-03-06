import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { HubConnectionBuilder } from "@microsoft/signalr";
import Country from "./components/Country";
import NewCountry from "./components/NewCountry";
import Grid from "@mui/material/Grid";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import "./App.css";

const App = () => {
	const apiEndpoint = "https://medalwebapp.azurewebsites.net/Api/country";
	const hubEndpoint = "https://medalshub.azurewebsites.net/medalsHub";

	// const apiEndpoint = "https://localhost:5001/api/country";
	// const hubEndpoint = "https://localhost:5001/medalsHub"



	const [countries, setCountries] = useState([]);
	const [connection, setConnection] = useState(null);

	const medals = useRef([
		{ id: 1, name: "gold" },
		{ id: 2, name: "silver" },
		{ id: 3, name: "bronze" },
	]);

	const latestCountries = useRef(null);
	// latestCountries.current is a ref variable to countries
	// this is needed to access state variable in useEffect w/o dependency
	latestCountries.current = countries;

	useEffect(() => {
		async function fetchCountries() {
			const { data: fetchedCountries } = await axios.get(apiEndpoint);
			setCountries(fetchedCountries);
		}
		fetchCountries();

		// signalR
		const newConnection = new HubConnectionBuilder()
			.withUrl(hubEndpoint)
			.withAutomaticReconnect()
			.build();

		setConnection(newConnection);
	}, []);

	  // componentDidUpdate (changes to connection)
	  useEffect(() => {
		if (connection) {
		  connection.start()
		  .then(() => {
			console.log('Connected!')

			connection.on('ReceiveAddMessage', country => {
				console.log(`Add: ${country.name}`);
				let mutableCountries = [...latestCountries.current];
				mutableCountries = mutableCountries.concat(country);
	  
				setCountries(mutableCountries);
			  });
			  connection.on('ReceiveDeleteMessage', id => {
				console.log(`Delete id: ${id}`);
				let mutableCountries = [...latestCountries.current];
				mutableCountries = mutableCountries.filter(c => c.id !== id);
	  
				setCountries(mutableCountries);
			  });
			  connection.on('ReceivePatchMessage', country => {
				console.log(`Patch: ${country.name}`);
				let mutableCountries = [...latestCountries.current];
				const idx = mutableCountries.findIndex(c => c.id === country.id);
				mutableCountries[idx] = country;
	  
				setCountries(mutableCountries);
			  });
		  })
		  .catch(e => console.log('Connection failed: ', e));
		}
	  // useEffect is dependent on changes connection
	  }, [connection]);

	const handleIncrement = (countryId, medalName) => handleUpdate(countryId, medalName, 1);
	const handleDecrement = (countryId, medalName) =>  handleUpdate(countryId, medalName, -1)
	const handleUpdate = async (countryId, medalName, factor) => {
	  const originalCountries = countries;
	  const idx = countries.findIndex(c => c.id === countryId);
	  const mutableCountries = [...countries ];
	  mutableCountries[idx][medalName] += (1 * factor);
	  setCountries(mutableCountries);
	  const jsonPatch = [{ op: "replace", path: medalName, value: mutableCountries[idx][medalName] }];
	  console.log(`json patch for id: ${countryId}: ${JSON.stringify(jsonPatch)}`);
  
	  try {
		await axios.patch(`${apiEndpoint}/${countryId}`, jsonPatch);
	  } catch (ex) {
		if (ex.response && ex.response.status === 404) {
		  // country already deleted
		  console.log("The record does not exist - it may have already been deleted");
		} else { 
		  alert('An error occurred while updating');
		  setCountries(originalCountries);
		}
	  }
	};
	

	const handleMedalCount = () => {
		let totalMedals = 0;
		medals.current.forEach(medal => {
			totalMedals += countries.reduce((a, b) => a + b[medal.name], 0);
		});
		return totalMedals;
	};

	//handle add country with axiox
	const handleAddCountry = async name => {
		await axios.post(apiEndpoint, { name: name });
	};

	//Handle delete country
	const handleDelete = async countryId => {
		const currentCountries = countries;
		setCountries(countries.filter(c => c.id !== countryId));
		try {
			await axios.delete(`${apiEndpoint}/${countryId}`);
		} catch (ex) {
			if (ex.response && ex.response.status === 404) {
				// country already deleted
				console.log(
					"The record does not exist - it may have already been deleted"
				);
			} else {
				alert("An error occurred while deleting");
				setCountries(currentCountries);
			}
		}
	};

	return (
		<div className="App">
			<Container>
				<Typography gutterBottom variant="h2" color="primary" align="center">
					{`Olympic Medals: `}
					{handleMedalCount()}
				</Typography>
				<Grid container spacing={3} sx={{ my: 2 }}>
					{countries.map(country => (
						<Grid item xs={12} md={6} lg={4} key={country.id}>
							<Country
								key={country.id}
								country={country}
								medals={medals.current}
								onIncrement={handleIncrement}
								onDecrement={handleDecrement}
								onDelete={handleDelete}
							/>
						</Grid>
					))}
				</Grid>
				<NewCountry onAddCountry={handleAddCountry} />
			</Container>
		</div>
	);
};
export default App;
