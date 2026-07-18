import React from "react";
import { createRoot } from "react-dom/client";
import Map from "./Map";
import "./style.css";

function App(){

return (
<div className="app">

<div className="sidebar">

<h1>
Peterborough<br/>
Dispatch Dashboard
</h1>

<div className="status">
● System Online
</div>

<input 
placeholder="Search address..."
/>

<button>
▶ Live Dispatch
</button>

<div className="panel">
AI Transcript
</div>

<div className="panel">
Recent Incidents
</div>

</div>


<Map />

</div>
)

}


createRoot(
document.getElementById("root")
)
.render(<App />);
