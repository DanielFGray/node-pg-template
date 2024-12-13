/// <reference types="Cypress" />

context('', () => {
  beforeEach(() => cy.serverCommand('clearTestUsers'))

  const user = {
    username: 'testuser',
    password: 'MyPassword1',
  }
  it('sends confirmation request and deletes account', () => {
    // Setup
    cy.login({ ...user, redirectTo: '/settings', verified: true })

    // Action
    cy.getCy('account-delete-request-button').click()

    // Assertion
    cy.contains('sent an email').should('exist')

    cy.serverCommand('getUserSecrets', { username: 'testuser' }).then(sc => {
      cy.visit(Cypress.env('VITE_ROOT_URL') + `/settings?delete_token=${sc.delete_account_token}`)
      cy.getCy('account-delete-confirm-button').should('exist')

      cy.getCy('account-delete-confirm-button').click()

      // Assertion
      cy.url().should('equal', Cypress.env('VITE_ROOT_URL') + '/')
      cy.getCy('nav-logout').should('not.exist') // should be logged out
      cy.getCy('nav-login').click()

      cy.url().should('equal', Cypress.env('VITE_ROOT_URL') + `/login`)
      cy.getCy('login-username-input').type(user.username)
      cy.getCy('login-password-input').type(user.password)
      cy.getCy('login-submit-button').click()

      // should fail
      cy.contains('invalid username or password').should('exist')
    })
  })
})
