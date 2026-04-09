package tunnel

// ─── GRE Types ───────────────────────────────────────────────────────────────

type GREEndpoint struct {
	RouterID      string `json:"routerId"`
	RouterName    string `json:"routerName"`
	Role          string `json:"role"`
	RosID         string `json:"rosId"`
	LocalAddress  string `json:"localAddress"`
	RemoteAddress string `json:"remoteAddress"`
	Running       bool   `json:"running"`
}

type MergedGRETunnel struct {
	Name               string        `json:"name"`
	TunnelType         string        `json:"tunnelType"`
	MTU                int           `json:"mtu"`
	KeepaliveInterval  int           `json:"keepaliveInterval"`
	KeepaliveRetries   int           `json:"keepaliveRetries"`
	IpsecSecret        string        `json:"ipsecSecret,omitempty"`
	Disabled           bool          `json:"disabled"`
	Comment            string        `json:"comment,omitempty"`
	Endpoints          []GREEndpoint `json:"endpoints"`
}

type CreateGRERequest struct {
	Name              string                  `json:"name"`
	MTU               int                     `json:"mtu"`
	KeepaliveInterval int                     `json:"keepaliveInterval"`
	KeepaliveRetries  int                     `json:"keepaliveRetries"`
	IpsecSecret       string                  `json:"ipsecSecret,omitempty"`
	Disabled          bool                    `json:"disabled"`
	Comment           string                  `json:"comment,omitempty"`
	Endpoints         []CreateGREEndpointInput `json:"endpoints"`
}

type CreateGREEndpointInput struct {
	RouterID      string `json:"routerId"`
	LocalAddress  string `json:"localAddress"`
	RemoteAddress string `json:"remoteAddress"`
}

type UpdateGRERequest struct {
	MTU               *int                    `json:"mtu,omitempty"`
	KeepaliveInterval *int                    `json:"keepaliveInterval,omitempty"`
	KeepaliveRetries  *int                    `json:"keepaliveRetries,omitempty"`
	IpsecSecret       *string                 `json:"ipsecSecret,omitempty"`
	Comment           *string                 `json:"comment,omitempty"`
	Disabled          *bool                   `json:"disabled,omitempty"`
	Endpoints         []UpdateGREEndpointInput `json:"endpoints,omitempty"`
}

type UpdateGREEndpointInput struct {
	RouterID      string  `json:"routerId"`
	LocalAddress  *string `json:"localAddress,omitempty"`
	RemoteAddress *string `json:"remoteAddress,omitempty"`
}

// ─── IPsec Types ─────────────────────────────────────────────────────────────

type Phase1Config struct {
	Encryption string `json:"encryption"`
	Hash       string `json:"hash"`
	DHGroup    string `json:"dhGroup"`
	Lifetime   string `json:"lifetime"`
}

type Phase2Config struct {
	Encryption    string `json:"encryption"`
	AuthAlgorithm string `json:"authAlgorithm"`
	PFSGroup      string `json:"pfsGroup"`
	Lifetime      string `json:"lifetime"`
}

type IPsecRosIDs struct {
	Peer     string   `json:"peer"`
	Profile  string   `json:"profile"`
	Proposal string   `json:"proposal"`
	Identity string   `json:"identity"`
	Policies []string `json:"policies,omitempty"`
}

type IPsecEndpoint struct {
	RouterID      string      `json:"routerId"`
	RouterName    string      `json:"routerName"`
	Role          string      `json:"role"`
	RosIDs        IPsecRosIDs `json:"rosIds"`
	LocalAddress  string      `json:"localAddress"`
	RemoteAddress string      `json:"remoteAddress"`
	Established   bool        `json:"established"`
}

type MergedIPsecTunnel struct {
	Name          string          `json:"name"`
	TunnelType    string          `json:"tunnelType"`
	Mode          string          `json:"mode"`
	AuthMethod    string          `json:"authMethod"`
	IpsecSecret   string          `json:"ipsecSecret,omitempty"`
	Phase1        Phase1Config    `json:"phase1"`
	Phase2        Phase2Config    `json:"phase2"`
	LocalSubnets  []string        `json:"localSubnets"`
	RemoteSubnets []string        `json:"remoteSubnets"`
	TunnelRoutes  []string        `json:"tunnelRoutes"`
	Disabled      bool            `json:"disabled"`
	Comment       string          `json:"comment,omitempty"`
	Endpoints     []IPsecEndpoint `json:"endpoints"`
}

type CreateIPsecRequest struct {
	Name          string                    `json:"name"`
	Mode          string                    `json:"mode"`
	AuthMethod    string                    `json:"authMethod"`
	IpsecSecret   string                    `json:"ipsecSecret,omitempty"`
	Phase1        Phase1Config              `json:"phase1"`
	Phase2        Phase2Config              `json:"phase2"`
	LocalSubnets  []string                  `json:"localSubnets,omitempty"`
	RemoteSubnets []string                  `json:"remoteSubnets,omitempty"`
	TunnelRoutes  []string                  `json:"tunnelRoutes,omitempty"`
	Disabled      bool                      `json:"disabled"`
	Comment       string                    `json:"comment,omitempty"`
	Endpoints     []CreateIPsecEndpointInput `json:"endpoints"`
}

type CreateIPsecEndpointInput struct {
	RouterID      string `json:"routerId"`
	LocalAddress  string `json:"localAddress"`
	RemoteAddress string `json:"remoteAddress"`
}

type UpdateIPsecRequest struct {
	Mode          *string                    `json:"mode,omitempty"`
	AuthMethod    *string                    `json:"authMethod,omitempty"`
	IpsecSecret   *string                    `json:"ipsecSecret,omitempty"`
	Comment       *string                    `json:"comment,omitempty"`
	Phase1        *Phase1Config              `json:"phase1,omitempty"`
	Phase2        *Phase2Config              `json:"phase2,omitempty"`
	LocalSubnets  []string                   `json:"localSubnets,omitempty"`
	RemoteSubnets []string                   `json:"remoteSubnets,omitempty"`
	TunnelRoutes  []string                   `json:"tunnelRoutes,omitempty"`
	Disabled      *bool                      `json:"disabled,omitempty"`
	Endpoints     []UpdateIPsecEndpointInput `json:"endpoints,omitempty"`
}

type UpdateIPsecEndpointInput struct {
	RouterID      string  `json:"routerId"`
	LocalAddress  *string `json:"localAddress,omitempty"`
	RemoteAddress *string `json:"remoteAddress,omitempty"`
}

// ─── WireGuard Types ──────────────────────────────────────────────────────────

type WGInterface struct {
	RosID      string `json:"rosId"`
	Name       string `json:"name"`
	ListenPort int    `json:"listenPort"`
	MTU        int    `json:"mtu"`
	PrivateKey string `json:"privateKey"`
	PublicKey  string `json:"publicKey"`
	Disabled   bool   `json:"disabled"`
	Running    bool   `json:"running"`
}

type WGPeer struct {
	RosID               string `json:"rosId"`
	Interface           string `json:"interface"`
	Name                string `json:"name,omitempty"`
	PublicKey           string `json:"publicKey"`
	PresharedKey        string `json:"presharedKey,omitempty"`
	AllowedAddress      string `json:"allowedAddress"`
	EndpointAddress     string `json:"endpointAddress,omitempty"`
	EndpointPort        int    `json:"endpointPort,omitempty"`
	LastHandshake       string `json:"lastHandshake,omitempty"`
	Rx                  int64  `json:"rx"`
	Tx                  int64  `json:"tx"`
	PersistentKeepalive int    `json:"persistentKeepalive,omitempty"`
	Disabled            bool   `json:"disabled"`
	Comment             string `json:"comment,omitempty"`
}

type RouterWireGuard struct {
	RouterID   string      `json:"routerId"`
	RouterName string      `json:"routerName"`
	Role       string      `json:"role"`
	Interface  WGInterface `json:"interface"`
	Peers      []WGPeer    `json:"peers"`
}

type CreateWGInterfaceRequest struct {
	RouterID   string `json:"routerId"`
	Name       string `json:"name"`
	ListenPort int    `json:"listenPort"`
	MTU        int    `json:"mtu,omitempty"`
	Disabled   bool   `json:"disabled"`
	Comment    string `json:"comment,omitempty"`
}

type UpdateWGInterfaceRequest struct {
	ListenPort *int    `json:"listenPort,omitempty"`
	MTU        *int    `json:"mtu,omitempty"`
	Disabled   *bool   `json:"disabled,omitempty"`
	Comment    *string `json:"comment,omitempty"`
}

type CreateWGPeerRequest struct {
	PublicKey           string `json:"publicKey"`
	PresharedKey        string `json:"presharedKey,omitempty"`
	AllowedAddress      string `json:"allowedAddress"`
	EndpointAddress     string `json:"endpointAddress,omitempty"`
	EndpointPort        int    `json:"endpointPort,omitempty"`
	PersistentKeepalive int    `json:"persistentKeepalive,omitempty"`
	Disabled            bool   `json:"disabled"`
	Comment             string `json:"comment,omitempty"`
}

type UpdateWGPeerRequest struct {
	PublicKey           *string `json:"publicKey,omitempty"`
	PresharedKey        *string `json:"presharedKey,omitempty"`
	AllowedAddress      *string `json:"allowedAddress,omitempty"`
	EndpointAddress     *string `json:"endpointAddress,omitempty"`
	EndpointPort        *int    `json:"endpointPort,omitempty"`
	PersistentKeepalive *int    `json:"persistentKeepalive,omitempty"`
	Disabled            *bool   `json:"disabled,omitempty"`
	Comment             *string `json:"comment,omitempty"`
}

// ─── Raw RouterOS Types ───────────────────────────────────────────────────────

type RawGRETunnel struct {
	ID            string `json:".id"`
	Name          string `json:"name"`
	LocalAddress  string `json:"local-address"`
	RemoteAddress string `json:"remote-address"`
	MTU           string `json:"mtu"`
	ActualMTU     string `json:"actual-mtu"`
	Keepalive     string `json:"keepalive"`
	IpsecSecret   string `json:"ipsec-secret"`
	Disabled      string `json:"disabled"`
	Running       string `json:"running"`
	Comment       string `json:"comment"`
}

type RawIPsecPeer struct {
	ID           string `json:".id"`
	Name         string `json:"name"`
	Address      string `json:"address"`
	LocalAddress string `json:"local-address"`
	Profile      string `json:"profile"`
	Disabled     string `json:"disabled"`
	Comment      string `json:"comment"`
}

type RawIPsecProfile struct {
	ID           string `json:".id"`
	Name         string `json:"name"`
	EncAlgorithm string `json:"enc-algorithm"`
	HashAlgorithm string `json:"hash-algorithm"`
	DHGroup      string `json:"dh-group"`
	Lifetime     string `json:"lifetime"`
}

type RawIPsecProposal struct {
	ID            string `json:".id"`
	Name          string `json:"name"`
	EncAlgorithms string `json:"enc-algorithms"`
	AuthAlgorithms string `json:"auth-algorithms"`
	PFSGroup      string `json:"pfs-group"`
	Lifetime      string `json:"lifetime"`
}

type RawIPsecIdentity struct {
	ID         string `json:".id"`
	Peer       string `json:"peer"`
	AuthMethod string `json:"auth-method"`
	Secret     string `json:"secret"`
}

type RawIPsecPolicy struct {
	ID         string `json:".id"`
	Peer       string `json:"peer"`
	SrcAddress string `json:"src-address"`
	DstAddress string `json:"dst-address"`
	Disabled   string `json:"disabled"`
}

type RawIPsecActivePeer struct {
	ID            string `json:".id"`
	State         string `json:"state"`
	RemoteAddress string `json:"remote-address"`
}

type RawWireGuardInterface struct {
	ID         string `json:".id"`
	Name       string `json:"name"`
	ListenPort string `json:"listen-port"`
	MTU        string `json:"mtu"`
	PrivateKey string `json:"private-key"`
	PublicKey  string `json:"public-key"`
	Disabled   string `json:"disabled"`
	Running    string `json:"running"`
}

type RawWireGuardPeer struct {
	ID                  string `json:".id"`
	Interface           string `json:"interface"`
	Name                string `json:"name"`
	PublicKey           string `json:"public-key"`
	PresharedKey        string `json:"preshared-key"`
	AllowedAddress      string `json:"allowed-address"`
	EndpointAddress     string `json:"endpoint-address"`
	EndpointPort        string `json:"endpoint-port"`
	LastHandshake       string `json:"last-handshake"`
	Rx                  string `json:"rx"`
	Tx                  string `json:"tx"`
	PersistentKeepalive string `json:"persistent-keepalive"`
	Disabled            string `json:"disabled"`
	Comment             string `json:"comment"`
}

// ─── Interface Types (cluster-scoped merge) ───────────────────────────────────

type InterfaceAddress struct {
	ID      string `json:"id"`
	Address string `json:"address"`
	Network string `json:"network"`
}

type InterfaceEndpoint struct {
	RouterID   string             `json:"routerId"`
	RouterName string             `json:"routerName"`
	Role       string             `json:"role"`
	RosID      string             `json:"rosId"`
	MACAddress string             `json:"macAddress"`
	Running    bool               `json:"running"`
	Addresses  []InterfaceAddress `json:"addresses"`
}

type MergedInterface struct {
	Name        string              `json:"name"`
	DefaultName string              `json:"defaultName,omitempty"`
	Type        string              `json:"type"`
	MTU         int                 `json:"mtu"`
	Disabled    bool                `json:"disabled"`
	Comment     string              `json:"comment,omitempty"`
	Endpoints   []InterfaceEndpoint `json:"endpoints"`
}
