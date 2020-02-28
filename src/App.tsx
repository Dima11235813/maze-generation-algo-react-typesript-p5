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

const broswerHistory = createBrowserHistory();
const history = syncHistoryWithStore(broswerHistory, stores.routerStore);


class App extends React.Component {
  render() {
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
