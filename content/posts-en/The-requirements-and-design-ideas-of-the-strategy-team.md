---
title: "Requirements and Design Ideas for Policy Groups"
summary: "This post shares requirements and design ideas for proxy policy groups across apps like Surge, Clash, Quantumult, and Quantumult X. By separating nodes into direct, public relay, and private relay routes and grouping them by region, you can match each service to its required region while keeping a direct option for flexible switching."
coverAlt: "Requirements and Design Ideas for Policy Groups"
sourceHash: "ce9d8146c8bc167c"
---

## Introduction

This post focuses on my design ideas for policy groups rather than step-by-step configuration for a specific app.
You can apply the same approach in Surge, Clash, Quantumult, or Quantumult X.

## Requirements

Once you have proxy access set up, you may end up with multiple nodes across several regions. If you use more than just YouTube—say Netflix, HBO, AbemaTV, iTunes Movie, KKTV, or Spotify—most of these streaming services enforce regional IP restrictions.
At the same time, each region often has several nodes, raising the question of which one works best under your current network conditions.

## Grouping by Route Type

The routes we commonly encounter fall into three categories: direct, public relay, and private relay (IPLC/IEPL). Each has its own use cases. However, in latency tests, latency typically ranks as direct > public relay > private relay. If you mix all three route types into a single auto-select (url-test) policy group, the private relay route will almost always be chosen automatically—even when the actual experience is worse than a direct connection.

## Grouping by Region

Each region unlocks different streaming services, so the first step is to group nodes by their exit region.
Common regions include Hong Kong, Japan, Singapore, and the United States, and you can add or remove regions based on your own needs.

## Putting It Together

Once both groupings are in place, your region groups should look something like this:
Hong Kong: Private Relay, Public Relay, Direct
Japan: Private Relay, Public Relay, Direct
Singapore: Private Relay, Public Relay, Direct
United States: Private Relay, Public Relay, Direct
Add any additional regions following the same pattern.
The final step is to assign the supported regions to each specific service. One tip here: keep a Direct option in every service group. That way, when you travel outside mainland China, you can simply switch to Direct and keep your setup working as usual instead of turning off your proxy entirely and falling back to local restrictions.
YouTube: Direct, Japan, United States
Netflix: Direct, Hong Kong, Singapore
HBO: Direct, Hong Kong, United States
AbemaTV: Direct, Japan
iTunes Movie: Direct, Hong Kong
KKTV: Direct, Taiwan
Spotify: Direct, United States

## Day-to-Day Usage

On initial setup, you only need to choose which region each app or service should use. This part rarely needs to be changed afterward.
In daily use, you only need to switch the route type inside each region group. After using it for a while, you will have a good sense of which route gives the best experience.
