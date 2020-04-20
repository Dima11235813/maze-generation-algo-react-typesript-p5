import React from "react";
import { Router, Switch } from "react-router";
import { Provider } from "mobx-react";
import { createBrowserHistory } from "history";
import { syncHistoryWithStore } from "mobx-react-router";

//Shared views
import Header from "./views/Header/Header";
// import Footer from "./views/Footer";

import { AppRoutes } from "./AppRoutes";
import { stores } from "./stores";
import { ErrorReport } from "./api/models/ErrorReport";
import errorReporter from "./utils/errorReporting";
import ErrorBoundary from "./components/ErrorBoundary";

const broswerHistory = createBrowserHistory();
const history = syncHistoryWithStore(broswerHistory, stores.routerStore);
//Comment to cause different build hash -- last /static/js/main.eb596332.chunk.js
class App extends React.Component {
  render() {
    // try {
    //   throw Error("Testing error reporting!");
    // } catch (e) {
    //   errorReporter.reportError(e);
    // }
    return (
      <Provider {...stores}>
        <Router history={history}>
          <Header />
          <Switch>{AppRoutes()}</Switch>
          {/* <Footer /> */}
        </Router>
      </Provider>
    );
  }
}

export default App;
