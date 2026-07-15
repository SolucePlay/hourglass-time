import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, Card, Divider, List, Text, useTheme } from 'react-native-paper';
import { getWhoami } from '../api/hourglass';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen() {
    const { jwt, xsrfToken } = useAuth();
    const navigation = useNavigation<any>();
    const theme = useTheme();
    const [infoBoardUrl, setInfoBoardUrl] = useState<string | null>(null);
    const [congregation, setCongregation] = useState<any>(null);
    const [user, setUser] = useState<any>(null);
    const [fsGroups, setFsGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const personName = (p?: any) => {
        if (!p) return 'Non défini';
        return `${p.firstname ?? ''} ${p.lastname ?? ''}`.trim() || 'Non défini';
    };

    const getGroupOrder = (group: any) => {
        const name = String(group?.name ?? '');
        const match = name.match(/GROUPE\s+(\d+)/i);
        return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
    };

    const displaySettingName = (name: string) =>
        name === 'infoBoardUrl' ? 'Google Drive' : String(name);

    const renderUserValue = (value: any) => (value === null || value === undefined ? '-' : String(value));

    useEffect(() => {
        (async () => {
            if (!jwt || !xsrfToken) return;
            const data = await getWhoami({ jwt, xsrfToken });
            const rawSettings = data?.settings;
            const rawFsGroups = data?.fsGroups;
            const rawCongregation = data?.congregation;
            const nextUser = data?.user && typeof data.user === 'object' ? data.user : null;
            const nextInfoBoardUrl =
                rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
                    ? rawSettings.infoBoardUrl ?? null
                    : null;

            setInfoBoardUrl(nextInfoBoardUrl ? String(nextInfoBoardUrl) : null);
            setFsGroups(
                Array.isArray(rawFsGroups)
                    ? [...rawFsGroups].sort((left, right) => getGroupOrder(left) - getGroupOrder(right))
                    : []
            );
            setUser(nextUser);
            setCongregation(rawCongregation && typeof rawCongregation === 'object' ? rawCongregation : null);
            setLoading(false);
        })();
    }, [jwt, xsrfToken]);

    if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

    return (
        <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16, gap: 16 }}>
            <Card>
                <Card.Title title="Paramètres" />
                <Card.Content>
                    {infoBoardUrl ? (
                        <List.Item
                            title={displaySettingName('infoBoardUrl')}
                            description={String(infoBoardUrl)}
                            left={(props) => <List.Icon {...props} icon="link-variant" />}
                            onPress={() => Linking.openURL(String(infoBoardUrl))}
                        />
                    ) : (
                        <Text>Aucun paramètre disponible.</Text>
                    )}
                </Card.Content>
            </Card>

            <Card>
                <Card.Title title="Congrégation" />
                <Card.Content>
                    {loading ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}

                    {!loading && !congregation ? <Text>Aucune congrégation disponible.</Text> : null}

                    {!loading && congregation ? (
                        <List.AccordionGroup>
                            <View
                                key={String(congregation.id ?? 38295)}
                                style={{ borderRadius: 20, overflow: 'hidden' }}
                            >
                                <List.Accordion
                                    id={String(congregation.id ?? 'congregation')}
                                    title={String(congregation.name ?? 'Inconnu')}
                                    style={{ borderRadius: 20 }}
                                    left={(props) => <List.Icon {...props} icon="domain" />}
                                >
                                    <List.Item
                                        title='Adresse'
                                        description={String(congregation.address ?? 'Inconnu')}
                                        descriptionNumberOfLines={4}
                                        descriptionEllipsizeMode="tail"
                                        left={(props) => <List.Icon {...props} icon="google-maps" />}
                                    />
                                    <List.Item
                                        title='Numéro de téléphone'
                                        description={String(congregation.phone ?? 'Inconnu')}
                                        left={(props) => <List.Icon {...props} icon="phone" />}
                                    />
                                    <List.Item
                                        title='Info supplémentaire'
                                        description={String(`Enregistré le: ${congregation.registered_at ?? 'Inconnu'}`) + '\n' + String(`Mise à jour: ${congregation.last_updated ?? 'Inconnu'}`)}
                                        descriptionNumberOfLines={2}
                                        descriptionEllipsizeMode="tail"
                                        left={(props) => <List.Icon {...props} icon="information" />}
                                    />
                                </List.Accordion>
                            </View>
                        </List.AccordionGroup>
                    ) : null}
                </Card.Content>
            </Card>

            <Card>
                <Card.Title title="Identité" />
                <Card.Content>
                    {loading ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}

                    {!loading && !user ? <Text>Aucune utilisateur disponible.</Text> : null}

                    {!loading && user ? (
                        <List.AccordionGroup>
                                <View
                                    key={String(user.id ?? 2460989)}
                                    style={{ borderRadius: 20, overflow: 'hidden' }}
                                >
                                    <List.Accordion
                                        id={String(user.id ?? 'user')}
                                        title={`${user?.firstname ?? ''} ${user?.lastname ?? ''}`.trim() || 'Utilisateur inconnu'}
                                        description={`ID: ${user?.id ?? '-'}`}
                                        left={(props) => <List.Icon {...props} icon="account" />}
                                    >
                                        <List.Item
                                            title="Genre"
                                            description={user?.sex === 'Male' ? 'Homme' : 'Femme'}
                                            left={(props) => <List.Icon {...props} icon="card-account-details-outline" />}
                                        />
                                        <List.Item
                                            title="Congrégation"
                                            description={renderUserValue(congregation?.name)}
                                            left={(props) => <List.Icon {...props} icon="card-account-details-outline" />}
                                        />
                                        <List.Item
                                            title="Groupe"
                                            description={renderUserValue(fsGroups?.find(group => group.id === 169843)?.name)}
                                            left={(props) => <List.Icon {...props} icon="card-account-details-outline" />}
                                        />
                                        <List.Item
                                            title="Statut"
                                            description={(user?.status === 'Baptized Publisher' ? 'Proclamateur Baptisé' : user?.status === 'Unbaptized Publisher' ? 'Proclamateur Non baptisé' : 'Inconnu')}
                                            left={(props) => <List.Icon {...props} icon="card-account-details-outline" />}
                                        />
                                        <List.Item
                                            title="Email de connexion"
                                            description={renderUserValue(user?.loginemail)}
                                            left={(props) => <List.Icon {...props} icon="card-account-details-outline" />}
                                        />
                                        <List.Item
                                            title="Dernière connexion"
                                            description={renderUserValue(user?.lastlogin)}
                                            left={(props) => <List.Icon {...props} icon="card-account-details-outline" />}
                                        />
                                        <List.Item
                                            title="Dernier jeton mobile"
                                            description={renderUserValue(user?.lastmobiletoken)}
                                            left={(props) => <List.Icon {...props} icon="card-account-details-outline" />}
                                        />
                                    </List.Accordion>
                                </View>
                        </List.AccordionGroup>
                    ) : null}
                </Card.Content>
            </Card>

            <Card>
                <Card.Title title="Groupes de prédication" subtitle={`${fsGroups.length} groupe(s)`} />
                <Card.Content>
                    {loading ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}

                    {!loading && fsGroups.length === 0 ? <Text>Aucun groupe disponible.</Text> : null}

                    {!loading && fsGroups.length > 0 ? (
                        <List.AccordionGroup>
                            {fsGroups.map((group, index) => (
                                <View
                                    key={String(group.id ?? index)}
                                    style={{ borderRadius: 20, overflow: 'hidden' }}
                                >
                                    <List.Accordion
                                        id={String(group.id ?? index)}
                                        title={group.name ?? 'Groupe sans nom'}
                                        description={`Surveillant: ${personName(group.overseer)}`}
                                        style={{ borderRadius: 20 }}
                                        left={(props) => <List.Icon {...props} icon="account-group" />}
                                    >
                                        <List.Item
                                            title="Surveillant"
                                            description={`${personName(group.overseer)} (id: ${group.overseer?.id ?? '-'})`}
                                            left={(props) => <List.Icon {...props} icon="account-star" />}
                                        />
                                        <List.Item
                                            title="Assistant"
                                            description={`${personName(group.assistant)} (id: ${group.assistant?.id ?? '-'})`}
                                            left={(props) => <List.Icon {...props} icon="account" />}
                                        />
                                        <List.Item
                                            title="Membres"
                                            description={Array.isArray(group.members) ? `${group.members.length} membre(s)` : 'Aucun membre listé'}
                                            left={(props) => <List.Icon {...props} icon="account-multiple" />}
                                        />
                                    </List.Accordion>
                                    {index < fsGroups.length - 1 ? <Divider /> : null}
                                </View>
                            ))}
                        </List.AccordionGroup>
                    ) : null}
                </Card.Content>
            </Card>

            {Platform.OS !== 'web' ? (
                <Card>
                    <Card.Title title="Connexion web" subtitle="Code à 6 chiffres" />
                    <Card.Content>
                        <Text>
                            Ouvre l'écran de connexion web mobile puis saisis le code affiché sur le PC.
                        </Text>
                        <Button
                            mode="contained"
                            style={{ marginTop: 12 }}
                            onPress={() => navigation.navigate('web_auth_scanner')}
                        >
                            Entrer code connexion web
                        </Button>
                    </Card.Content>
                </Card>
            ) : null}
        </ScrollView>
    );
}
