/// <reference types="Cypress" />

context('HomePage', () => {
  it('renders correctly', () => {
    // Setup
    cy.visit(Cypress.env('VITE_ROOT_URL'))

    // Action

    // Assertions
    cy.url().should('equal', Cypress.env('VITE_ROOT_URL') + '/')
    cy.getCy('nav').should('exist')
  })
})
