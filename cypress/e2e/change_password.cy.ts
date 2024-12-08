/// <reference types="Cypress" />

context('change password', () => {
  beforeEach(() => cy.serverCommand('clearTestUsers'))

  it('user can change password, log out, and log in with new password', () => {
    // Setup
    cy.login({ redirectTo: '/settings', password: 'oldpassword', verified: true })

    // Action
    cy.getCy('settings-old-password-input').type('oldpassword!') // use incorrect password
    cy.getCy('settings-new-password-input').type('newpassword')
    cy.getCy('settings-confirm-password-input').type('newpassword')
    cy.getCy('settings-change-password-submit').click()

    // Assertion
    cy.contains('password was incorrect').should('exist') // should fail

    // use correct password
    cy.getCy('settings-old-password-input').type('{backspace}')
    cy.getCy('settings-change-password-submit').click()

    // Assertion
    cy.contains('password updated').should('exist')

    // Action
    cy.getCy('nav-logout').click()
    cy.getCy('logout-submit').click() // log out

    // should be logged out
    // should be logged out
    cy.getCy('nav-login').should('exist')

    cy.getCy('nav-login').click()
    cy.getCy('login-username-input').type('testuser')
    cy.getCy('login-password-input').type('newpassword')
    cy.getCy('login-submit-button').click()

    // Assertion
    cy.getCy('nav-login').should('not.exist') // should be logged in
    cy.getCy('nav-logout').should('exist')
  })
})
