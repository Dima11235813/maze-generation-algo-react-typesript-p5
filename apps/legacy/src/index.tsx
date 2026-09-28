import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import * as serviceWorker from "./serviceWorker";
import AppWrapper from "./AppWrapper";
import errorReporter from "./utils/errorReporting";

try {
  ReactDOM.render(<AppWrapper />, document.getElementById("root"));
} catch (e) {
  errorReporter.reportError(e);
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
