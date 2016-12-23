import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import { Router, browserHistory } from 'react-router';
import { syncHistoryWithStore } from 'react-router-redux';
// import FastClick from 'fastclick';
import ApolloClient, { createNetworkInterface } from 'apollo-client';
import { ApolloProvider } from 'react-apollo';
import { AppContainer as Hot } from 'react-hot-loader';

const createClient = ({
  createRoutes,
  configureStore,
  preRenderMiddleware,
  WithStylesContext,
  graphqlUrl,
  timeout,
}) => {
  // Grab the state from a global injected into
  // server-generated HTML
  const initialState = window.__INITIAL_STATE__;
  const store = configureStore(initialState, browserHistory);
  const history = syncHistoryWithStore(browserHistory, store);
  // console.log(createRoutes);
  const routes = createRoutes(store);
  const client = new ApolloClient({
    ssrMode: true,
    networkInterface: createNetworkInterface({
      uri: graphqlUrl,
    }),
    initialState,
  });
  let timer;

  // Make taps on links and buttons work fast on mobiles
  // FastClick.attach(document.body);

  /**
   * Callback function handling frontend route changes.
   */
  function onUpdate() {
    // Prevent duplicate fetches when first loaded.
    // Explanation: On server-side render, we already have __INITIAL_STATE__
    // So when the client side onUpdate kicks in, we do not need to fetch twice.
    // We set it to null so that every subsequent client-side navigation will
    // still trigger a fetch data.
    // Read more: https://github.com/choonkending/react-webpack-node/pull/203#discussion_r60839356
    if (window.__INITIAL_STATE__ !== null) {
      window.__INITIAL_STATE__ = null;
      return;
    }

    const { components, params } = this.state;

    preRenderMiddleware(store.dispatch, components, params);
  }

  /**
   * Timer
   * Start timer, reset to location set after timeout. Only reset page if location param is set.
   */
  let startTimer = () => {
    console.log('startTimer ', timeout);

    timer = setTimeout(() => {
      let locationSetSlug, currentSetSlug, objectSlug;

      /**
       * Listen for changes to the current location.
       */
      const unlisten = history.listen(location => {
        const pathnameArray = location.pathname.split('/');

        locationSetSlug = (pathnameArray[1] === 'location') ? pathnameArray[2] : '';
        currentSetSlug = (pathnameArray[3] === 'set') ? pathnameArray[4] : '';
        objectSlug = (pathnameArray[5] === 'object') ? pathnameArray[6] : '';
      })

      // When you're finished, stop the listener.
      unlisten();

      // Only enable timeout reset if location is set, current set isn't location set, or on an object page
      if ((currentSetSlug != locationSetSlug && locationSetSlug && currentSetSlug) || objectSlug) {
        window.open(`/location/${locationSetSlug}/set/${locationSetSlug}?timeout=true`, '_self');
      }
    }, timeout);
  }
  startTimer();

  // Add event listeners for click and touch.
  document.addEventListener('click', () => {
    clearTimeout(timer);
    startTimer();
  });

  document.addEventListener('touchend', () => {
    clearTimeout(timer);
    startTimer();
  });

  let routeConfig;

  function renderRoutes(theRoutes) {
    // Router converts <Route> element hierarchy to a route config:
    // Read more https://github.com/rackt/react-router/blob/latest/docs/Glossary.md#routeconfig

    render(
      <Hot>
        <ApolloProvider store={store} client={client}>
          <WithStylesContext onInsertCss={styles => {
            styles._insertCss();
          }}>
            {/*
              https://github.com/gaearon/react-hot-loader/issues/298
              https://github.com/gaearon/react-hot-loader/issues/249
            */}
            <Router
              key={Date.now()}
              history={history}
              // NOTE: Leaving this off for now, may not be needed anymore.
              // onUpdate={onUpdate}
              routes={theRoutes}
            >
            </Router>
          </WithStylesContext>
        </ApolloProvider>
      </Hot>, document.getElementById('app')
    );
  }

  renderRoutes(routes);
}

export default createClient;
