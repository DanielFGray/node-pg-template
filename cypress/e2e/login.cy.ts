/// <reference types="Cypress" />

const PASSWORD = 'MyPassword1'

context('Login', () => {
  beforeEach(() => cy.serverCommand('clearTestUsers'))

  it('can log in', () => {
    // Setup
    cy.serverCommand('createUser', {
      username: 'testuser',
      name: 'Test User',
      verified: true,
      password: PASSWORD,
    })
    cy.visit(Cypress.env('VITE_ROOT_URL') + '/login')

    // Action
    cy.getCy('login-username-input').type('testuser')
    cy.getCy('login-password-input').type(PASSWORD)
    cy.getCy('login-submit-button').click()

    // Assertion
    cy.url().should('equal', Cypress.env('VITE_ROOT_URL') + '/') // Should be on homepage
    cy.getCy('nav').should('contain', 'testuser') // Should be logged in
  })

  it('fails on bad password', () => {
    // Setup
    cy.serverCommand('createUser', {
      username: 'testuser',
      name: 'Test User',
      verified: true,
      password: PASSWORD,
    })
    cy.visit(Cypress.env('VITE_ROOT_URL') + '/login')
    cy.getCy('login-submit-button').click()

    // Action
    cy.getCy('login-username-input').type('testuser')
    cy.getCy('login-password-input').type(PASSWORD + '!')
    cy.getCy('login-submit-button').click()

    // Assertion
    cy.contains('invalid username or password').should('exist')
    cy.url().should('equal', Cypress.env('VITE_ROOT_URL') + '/login') // Should be on login page still

    // But can recover
    cy.getCy('login-password-input').type('{backspace}') // Delete the '!' that shouldn't be there
    cy.getCy('login-submit-button').click()
    cy.url().should('equal', Cypress.env('VITE_ROOT_URL') + '/') // Should be on homepage
    cy.getCy('nav').should('contain', 'testuser') // Should be logged in
  })
})
