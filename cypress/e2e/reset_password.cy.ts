/// <reference types="" />

context('reset password', () => {
  beforeEach(() => cy.serverCommand('clearTestUsers'))

  it('can navigate to recovery page', () => {
    // Action
    cy.visit(Cypress.env('VITE_ROOT_URL') + '/')
    cy.getCy('nav-login').click()
    cy.url().should('equal', Cypress.env('VITE_ROOT_URL') + '/login')
    cy.getCy('login-submit-button').click()
    cy.getCy('login-forgot-link').click()

    // Assertion
    cy.getCy('forgot-submit-button').should('exist')
  })

  it('can reset password and log in', () => {
    // Action
    cy.serverCommand('createUser', {
      username: 'testuser',
      name: 'Test User',
      verified: true,
      password: 'some password',
    })
    cy.visit(Cypress.env('VITE_ROOT_URL') + '/forgot')
    cy.getCy('forgot-email-input').type('testuser@example.com')
    cy.getCy('forgot-submit-button').click()

    // Assertion
    cy.contains('sent a link to your email').should('exist')

    cy.serverCommand('getUserSecrets', { username: 'testuser' }).then(sc => {
      const token = sc.reset_password_token
      const userId = sc.user_id

      // Action
      cy.visit(
        Cypress.env('VITE_ROOT_URL') + '/reset?' + new URLSearchParams({ userId }).toString(),
      )
      cy.getCy('reset-token-input').type(token + '!') // wrong token
      cy.getCy('reset-password-input').type('a new password')
      cy.getCy('reset-confirm-password-input').type('a new password')
      cy.getCy('reset-submit-button').click()

      // Assertion
      cy.getCy('reset-submit-button').should('exist') // wrong token fails

      // Action
      cy.getCy('reset-token-input').type('{backspace}') // can recover
      cy.getCy('reset-submit-button').click()

      // Assertion
      cy.getCy('reset-submit-button').should('not.exist') // correct token succeeds
      cy.url().should('equal', Cypress.env('VITE_ROOT_URL') + '/') // frustrated user is conveniently logged in after reset
    })
  })
})
