/// <reference types="Cypress" />

export {}

context('Subscriptions', () => {
  beforeEach(() => cy.serverCommand('clearTestUsers'))

  const testuser = {
    username: 'testuser',
    email: 'testuser@test.com',
    name: 'Test User',
    verified: false,
    password: 'MyPassword1',
  }

  it('can log in; current user subscription works', () => {
    // Setup
    cy.serverCommand('createUser', testuser)
    cy.visit(Cypress.env('VITE_ROOT_URL') + '/login')
    cy.getCy('login-submit-button').click()
    // cy.getCy('nav-login').should('not.exist') // No login button on login page

    // Action
    cy.getCy('login-username-input').type(testuser.username)
    cy.getCy('login-password-input').type(testuser.password)
    cy.getCy('login-submit-button').click()

    // Assertion
    cy.url().should('equal', Cypress.env('VITE_ROOT_URL') + '/') // Should be on homepage
    cy.getCy('nav-login').should('not.exist') // Should be logged in
    cy.getCy('nav').should('contain', testuser.username) // Should be logged in

    // Subscription
    cy.getCy('unverified-account-warning').should('exist')
    cy.serverCommand('verifyUser')
    cy.getCy('unverified-account-warning').should('not.exist')
  })

  it('can start on an already logged-in session; current user subscription works', () => {
    // Setup
    cy.login({ redirectTo: '/', verified: false })

    // Subscription
    cy.getCy('unverified-account-warning').should('exist')
    cy.serverCommand('verifyUser')
    cy.getCy('unverified-account-warning').should('not.exist')
  })

  it('can register; current user subscription works', () => {
    // Setup
    cy.visit(Cypress.env('VITE_ROOT_URL') + '/register')
    cy.getCy('nav-login').should('not.exist') // No login button on register page

    // Action
    cy.getCy('register-username-input').type(testuser.username)
    cy.getCy('register-email-input').type(testuser.email)
    cy.getCy('register-password-input').type(testuser.password)
    cy.getCy('register-confirm-password-input').type(testuser.password)
    cy.getCy('register-submit-button').click()

    // Assertions
    cy.url().should('equal', Cypress.env('VITE_ROOT_URL') + '/') // Should be on homepage
    cy.getCy('nav-login').should('not.exist')
    cy.getCy('nav').should('contain', testuser.username) // Should be logged in

    // Subscription
    cy.getCy('unverified-account-warning').should('exist')
    cy.serverCommand('verifyUser')
    cy.getCy('unverified-account-warning').should('not.exist')
  })
})
