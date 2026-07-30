# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Managers approving budgets and tracking expenses.

## Product Purpose
A streamlined dashboard to track, visualize, and export personnel payments backed by Google Sheets.

## Positioning
An internal tool focused on fast, transparent expense tracking leveraging Google Sheets for data storage and management.

## Operating Context
Used in an office or administrative environment by managers to review personnel costs, salaries, and allowances.

## Capabilities and Constraints
- Must maintain the Google Sheets integration as the data backend.
- Must keep the current data schema (salary/allowance categories) intact.
- Must preserve Excel (xlsx) export capabilities.

## Brand Commitments
None specified.

## Evidence on Hand
Current Next.js implementation with Google Sheets API and Recharts integration.

## Product Principles
- **Data Fidelity:** Google Sheets remains the single source of truth; the app must accurately reflect and sync with it.
- **Exportability:** Managers must always be able to pull data out into standard formats (Excel) for external reporting.
- **Clarity:** The dashboard should prioritize clear visualization of expenses and budgets over complex features.
