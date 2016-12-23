/*! React Starter Kit | MIT License | http://www.reactstarterkit.com/ */

import 'babel-polyfill';
import path from 'path';
import express from 'express';
import React from 'react';
import ReactDOM from 'react-dom/server';
import { renderToString } from 'react-dom/server';
import { Provider } from 'react-redux';
import { createMemoryHistory, match, RouterContext } from 'react-router';
import ApolloClient, { createNetworkInterface } from 'apollo-client';
import { ApolloProvider } from 'react-apollo';
import { getDataFromTree } from 'react-apollo/server';
import fetch from 'isomorphic-fetch'; // Required for Apollo
import Helmet from 'react-helmet';

const createServer = ({
  assets,
  Router,
  Html,
  configureStore,
  createRoutes,
  preRenderMiddleware,
  WithStylesContext,
}) => {
  // const server = global.server = express();
  const port = process.env.PORT || 5000;
  const serverRoute = express.Router();
  // server.set('port', port);

  console.log("server.js");
  console.log(`
    API_URL=${process.env.API_URL}
    GRAPHQL_URL=${process.env.GRAPHQL_URL}
    URL=${process.env.URL}
    ENV=${process.env.ENV}
  `);

  //
  // Register Node.js middleware
  // -----------------------------------------------------------------------------
  serverRoute.use(express.static(path.join(__dirname, 'public')));

  //
  // Register server-side rendering middleware
  // -----------------------------------------------------------------------------
  serverRoute.get('*', (req, res, next) => {
    let statusCode = 200;

    const history = createMemoryHistory();
    const store = configureStore({}, history);
    const routes = createRoutes(store);
    const scripts = [
      assets.vendor.js,
      assets.client.js,
    ];

    /*
     * From the react-router docs:
     *
     * This function is to be used for server-side rendering. It matches a set of routes to
     * a location, without rendering, and calls a callback(err, redirect, props)
     * when it's done.
     *
     * The function will create a `history` for you, passing additional `options` to create it.
     * These options can include `basename` to control the base name for URLs, as well as the pair
     * of `parseQueryString` and `stringifyQuery` to control query string parsing and serializing.
     * You can also pass in an already instantiated `history` object, which can be constructured
     * however you like.
     *
     * The three arguments to the callback function you pass to `match` are:
     * - err:       A javascript Error object if an error occured, `undefined` otherwise.
     * - redirect:  A `Location` object if the route is a redirect, `undefined` otherwise
     * - props:     The props you should pass to the routing context if the route matched,
     *              `undefined` otherwise.
     * If all three parameters are `undefined`, this means that there was no route found matching the
     * given location.
     */
    match({routes, location: req.url}, (err, redirect, props) => {
      if (err) {
        res.status(500).json(err);
      } else if (redirect) {
        res.redirect(302, redirect.pathname + redirect.search);
      } else if (props) {
        // This method waits for all render component
        // promises to resolve before returning to browser

        preRenderMiddleware(
          store.dispatch,
          props.components,
          props.params
        )
        .then(() => {
          const css = new Set();
          // const initialState = store.getState();

          const client = new ApolloClient({
            ssrMode: true,
            // ssrForceFetchDelay: 2000,
            // Remember that this is the interface the SSR server will use to connect to the
            // API server, so we need to ensure it isn't firewalled, etc
            networkInterface: createNetworkInterface({
              uri: process.env.GRAPHQL_URL,
              // credentials: 'same-origin',
              // transfer request headers to networkInterface so that they're accessible to proxy server
              // Addresses this issue: https://github.com/matthew-andrews/isomorphic-fetch/issues/83
              // headers: req.headers,
            }),
            // shouldBatch: true,
          });

          const componentHTML = (
            <ApolloProvider client={client} store={store}>
              <WithStylesContext onInsertCss={(...styles) => {
                styles.forEach(style => css.add(style._getCss()));
              }}>
                <RouterContext {...props} />
              </WithStylesContext>
            </ApolloProvider>
          );

          getDataFromTree(componentHTML).then((context) => {
            let head = Helmet.rewind();
            const content = ReactDOM.renderToString(componentHTML);
            let initialState = context.store.getState();
            const { data } = context.client.store.getState().apollo;
            initialState = { apollo: { data } };
            const scriptTags = scripts.map((script) => {
              return `<script src="${script}"></script>`;
            })

            // TODO: Would prefer to use Html component but having troubles getting
            // React Helmet title, meta and link to work.
            // const html = (
            //   <Html
            //     title={`${head.title}`}
            //     meta={`${head.meta}`}
            //     link={`${head.link}`}
            //     description=""
            //     content={content}
            //     initialState={initialState}
            //     css={css.join('')}
            //   />
            // );
            // res.send(`<!doctype html>\n${ReactDOM.renderToStaticMarkup(html)}`);

            res.status(200);
            res.send(`
              <!doctype html>
              <html>
                <head>
                  <meta charset="utf-8" />
                  ${head.title}
                  ${head.meta}
                  ${head.link}
                  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                  <link rel="stylesheet" href="/components/font-awesome/css/font-awesome.min.css" />
                  <link rel="stylesheet" href="/components/photoswipe/photoswipe.css" />
                  <link rel="stylesheet" href="/components/photoswipe/default-skin/default-skin.css" />
                  <link rel="apple-touch-icon" href="apple-touch-icon.png" />
                  <style>${[...css].join('')}</style>
                </head>
                <body>
                  <div id="app">${content}</div>
                  <script>window.__INITIAL_STATE__ = ${JSON.stringify(initialState)};</script>
                  ${scriptTags.join('')}
                </body>
              </html>
            `);

            res.end();
          }).catch(e => console.error('RENDERING ERROR:', e));

        })
        .catch((err) => {
          console.log(err);
          res.status(500).json(err);
        });
      } else {
        res.sendStatus(404);
      }
    });
  });

  return serverRoute;
}


// export default serverRoute;
export default createServer;

//
// Launch the server
// -----------------------------------------------------------------------------
// server.listen(port, () => {
//   /* eslint-disable no-console */
//   console.log(`The server is running at http://localhost:${port}/`);
// });
