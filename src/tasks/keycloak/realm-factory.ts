/* eslint-disable @typescript-eslint/ban-types */
import {
  ClientRepresentation,
  ClientScopeRepresentation,
  GroupRepresentation,
  IdentityProviderMapperRepresentation,
  IdentityProviderRepresentation,
  ProtocolMapperRepresentation,
  RealmRepresentation,
  RoleRepresentation,
  UserRepresentation,
} from '@redkubes/keycloak-client-node'
import { defaultsDeep } from 'lodash'
import * as utils from '../../utils'
import {
  FEAT_EXTERNAL_IDP,
  IDP_ALIAS,
  IDP_CLIENT_ID,
  IDP_CLIENT_SECRET,
  IDP_GROUP_MAPPINGS_TEAMS,
  IDP_GROUP_OTOMI_ADMIN,
  IDP_GROUP_TEAM_ADMIN,
  IDP_OIDC_URL,
  IDP_SUB_CLAIM_MAPPER,
  IDP_USERNAME_CLAIM_MAPPER,
  KC_HOSTNAME_URL,
  KEYCLOAK_CLIENT_SECRET,
  KEYCLOAK_REALM,
  REDIRECT_URIS,
  TEAM_IDS,
  cleanEnv,
} from '../../validators'
import {
  TeamMapping,
  adminUserCfgTpl,
  clientEmailClaimMapper,
  clientScopeCfgTpl,
  defaultsIdpMapperTpl,
  idpMapperTpl,
  idpProviderCfgTpl,
  otomiClientCfgTpl,
  protocolMappersList,
  realmCfgTpl,
  roleTpl,
} from './config'

const env = cleanEnv({
  FEAT_EXTERNAL_IDP,
  IDP_CLIENT_ID,
  IDP_CLIENT_SECRET,
  IDP_ALIAS,
  KC_HOSTNAME_URL,
  KEYCLOAK_CLIENT_SECRET,
  KEYCLOAK_REALM,
  REDIRECT_URIS,
  IDP_GROUP_OTOMI_ADMIN,
  IDP_GROUP_TEAM_ADMIN,
  IDP_GROUP_MAPPINGS_TEAMS,
  IDP_OIDC_URL,
  IDP_SUB_CLAIM_MAPPER,
  IDP_USERNAME_CLAIM_MAPPER,
  TEAM_IDS,
})

export function createClient(redirectUris: string[], webOrigins: string[], secret: string): ClientRepresentation {
  const otomiClientRepresentation = defaultsDeep(
    new ClientRepresentation(),
    otomiClientCfgTpl(secret, redirectUris, webOrigins),
  )
  return otomiClientRepresentation
}

export function createGroups(teamIds: string[]): Array<GroupRepresentation> {
  const groupNames: string[] = teamIds.map((id) => `team-${id}`).concat(['otomi-admin', 'team-admin'])
  const groups = groupNames.map((name) => defaultsDeep(new GroupRepresentation(), { name }))
  return groups
}

export function createIdpMappers(idpAlias: string, teams: string[], adminGroupMapping: string, teamAdminGroupMapping: string, userClaimMapper: string, idpSubClaimMapper: string): Array<IdentityProviderMapperRepresentation> {
  // admin idp mapper case
  const admin = idpMapperTpl('otomi-admin group to role', idpAlias, 'admin', adminGroupMapping)
  const adminMapper = defaultsDeep(new IdentityProviderMapperRepresentation(), admin)
  // team admin idp mapper case
  const teamAdmin = idpMapperTpl('team-admin group to role', idpAlias, 'team-admin', teamAdminGroupMapping)
  const teamAdminMapper = defaultsDeep(new IdentityProviderMapperRepresentation(), teamAdmin)

  // default idp mappers case
  const defaultIdps = defaultsIdpMapperTpl(idpAlias, userClaimMapper, idpSubClaimMapper)

  const defaultMapper = defaultIdps.map((idpMapper) =>
    defaultsDeep(new IdentityProviderMapperRepresentation(), idpMapper),
  )
  // team idp case - team list extracted from IDP_GROUP_MAPPINGS_TEAMS env
  const teamList = utils.objectToArray(teams || [], 'name', 'groupMapping') as TeamMapping[]
  const teamMappers = teamList.map((team) => {
    const teamMapper = idpMapperTpl(`${team.name} group to role`, idpAlias, team.name, team.groupMapping)
    return defaultsDeep(new IdentityProviderMapperRepresentation(), teamMapper)
  })
  return teamMappers.concat(defaultMapper).concat(adminMapper).concat(teamAdminMapper)
}

export async function createIdProvider(clientId: string, alias: string, clientSecret: string, oidcUrl: string): Promise<IdentityProviderRepresentation> {
  const otomiClientIdp = defaultsDeep(
    new IdentityProviderRepresentation(),
    await idpProviderCfgTpl(alias, clientId, clientSecret, oidcUrl),
  )
  return otomiClientIdp
}

export function createProtocolMappersForClientScope(): Array<ProtocolMapperRepresentation> {
  const protocolMapperRepresentations = protocolMappersList.map((protoMapper) =>
    defaultsDeep(new ProtocolMapperRepresentation(), protoMapper),
  )
  return protocolMapperRepresentations
}

export function createClientEmailClaimMapper(): ProtocolMapperRepresentation {
  const emailClaimMapper = defaultsDeep(new ProtocolMapperRepresentation(), clientEmailClaimMapper())
  return emailClaimMapper
}

export function createAdminUser(username: string, password: string): UserRepresentation {
  const userRepresentation = defaultsDeep(new UserRepresentation(), adminUserCfgTpl(username, password))
  return userRepresentation
}

export function createRealm(realm: string): RealmRepresentation {
  const realmRepresentation = defaultsDeep(new RealmRepresentation(), realmCfgTpl(realm))
  return realmRepresentation
}

export function createClientScopes(): ClientScopeRepresentation {
  const clientScopeRepresentation = defaultsDeep(
    new ClientScopeRepresentation(),
    clientScopeCfgTpl(createProtocolMappersForClientScope()),
  )
  return clientScopeRepresentation
}

export function mapTeamsToRoles(teamIds: string[], idpGroupMappings: string[], idpGroupTeamAdmin: string, groupOtomiAdmin: string, realm: string): Array<RoleRepresentation> {
  const teams =
    idpGroupMappings ??
    (teamIds as string[]).reduce((memo: any, name) => {
      // eslint-disable-next-line no-param-reassign
      memo[`team-${name}`] = undefined
      return memo
    }, {})
  // create static admin teams
  const teamAdmin = Object.create({ name: 'team-admin', groupMapping: idpGroupTeamAdmin }) as TeamMapping
  const adminTeams = [teamAdmin]
  const otomiAdmin = Object.create({
    name: 'admin',
    groupMapping: groupOtomiAdmin,
  }) as TeamMapping
  adminTeams.push(otomiAdmin)
  // iterate through all the teams and map groups
  const teamList = utils.objectToArray(teams || [], 'name', 'groupMapping') as TeamMapping[]
  const teamRoleRepresentations = adminTeams.concat(teamList).map((team) => {
    const role = roleTpl(team.name, team.groupMapping, realm)
    const roleRepresentation = defaultsDeep(new RoleRepresentation(), role)
    return roleRepresentation
  })
  return teamRoleRepresentations
}

export function createLoginThemeConfig(loginTheme = 'otomi'): RealmRepresentation {
  return defaultsDeep(new RealmRepresentation(), { loginTheme })
}
