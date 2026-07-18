---
title: Introduction
description: What SahneJS does, where it fits, and the concepts used throughout the documentation.
---

# Introduction

SahneJS is a Node.js CLI and library for controlling browser requests during development. It opens a target page with Puppeteer, evaluates your interceptor rules for each request, and either lets the request continue or supplies a response from a proxy, a local file, or your own hook.

The page keeps its target URL and browser context. That makes Sahne useful when a local change needs to run alongside real routing, cookies, authentication, or backend services.

## Good uses for Sahne

- Run a local single-page application on a deployed domain without deploying it.
- Replace one API response with a local fixture while the rest of the application remains live.
- Rewrite request or response data to reproduce a hard-to-create state.
- Validate a frontend fix against real services and navigation.
- Reuse the interceptor directly in an existing Puppeteer workflow.

::: warning Use production access carefully
Sahne can work inside an authenticated browser. Interceptor rules can see and modify requests, so use configurations you trust. Connected-browser mode limits interception to one fresh Sahne-managed tab unless you explicitly enable the all-tabs escape hatch.
:::

## Core concepts

| Term            | Meaning                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| **Target**      | The HTTP or HTTPS page set by `initialUrl`.                                 |
| **Rule**        | One `interceptor` object that decides whether and how to handle a request.  |
| **Match**       | A string glob, regular expression, predicate, or array of those values.     |
| **Proxy**       | A development or alternate server that supplies a response.                 |
| **File mock**   | A local file used as the response body.                                     |
| **Managed tab** | The fresh tab Sahne creates when it connects to an existing Chrome session. |

## What Sahne does not replace

Sahne is not a general-purpose forward proxy and does not change system-wide browser traffic. It operates through Puppeteer's request interception on pages it manages.

It also does not start your development server. Run Vite, another frontend server, or any proxy target separately before starting Sahne.

## Choose a path

- Follow [Getting started](./getting-started.md) for a small file-backed mock.
- Follow [Proxy a local app](./proxy-local-app.md) to run a local frontend under a target domain.
- Read [How Sahne works](./how-it-works.md) before creating multi-rule configurations.
