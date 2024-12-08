/// <reference types="Cypress" />

context('RegisterAccount', () => {
  beforeEach(() => cy.serverCommand('clearTestUsers'))

  it('can navigate to registration page', () => {
    // Setup
    cy.visit(Cypress.env('VITE_ROOT_URL'))

    // Action
    cy.getCy('nav-register').click()

    // Assertions
    cy.url().should('equal', Cypress.env('VITE_ROOT_URL') + '/register')
    cy.getCy('register-email-label').should('exist')
  })

  it('requires the form be filled', () => {
    // Setup
    cy.visit(Cypress.env('VITE_ROOT_URL') + '/register')

    // Action
    cy.getCy('register-submit-button').click()

    // Assertions
    cy.getCy('register-email-label').should('exist')
  })

  context('Account creation', () => {
    beforeEach(() => cy.serverCommand('clearTestUsers'))

    it('enables account creation', () => {
      // Setup
      cy.visit(Cypress.env('VITE_ROOT_URL') + '/register')
      cy.getCy('nav-login').should('not.exist') // No login button on register page

      // Action
      cy.getCy('register-username-input').type('testuser')
      cy.getCy('register-password-input').type('Really Good Password')
      cy.getCy('register-confirm-password-input').type('Really Good Password')
      cy.getCy('register-submit-button').click()

      // Assertions
      cy.url().should('equal', Cypress.env('VITE_ROOT_URL') + '/') // Should be on homepage
      cy.getCy('nav-login').should('not.exist')
      cy.getCy('nav').should('contain', 'testuser') // Should be logged in
    })

    it('prevents creation if username is in use', () => {
      // Setup
      cy.serverCommand('createUser', { username: 'testuser' })
      cy.visit(Cypress.env('VITE_ROOT_URL') + '/register')

      // Action
      cy.getCy('register-username-input').type('testuser')
      cy.getCy('register-email-input').type('test.user@example.com')
      cy.getCy('register-password-input').type('Really Good Password')
      cy.getCy('register-confirm-password-input').type('Really Good Password')
      cy.getCy('register-submit-button').click()

      // Assertions
      cy.contains('username already exists').should('exist')
    })
  })
})
