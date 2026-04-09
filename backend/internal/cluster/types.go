package cluster

import "time"

type Cluster struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ClusterResponse struct {
	ID        string           `json:"id"`
	Name      string           `json:"name"`
	Mode      string           `json:"mode"`
	CreatedAt time.Time        `json:"created_at"`
	Routers   []RouterResponse `json:"routers"`
}

type RouterResponse struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Hostname    string     `json:"hostname"`
	Host        string     `json:"host"`
	Port        int        `json:"port"`
	Role        string     `json:"role"`
	IsReachable bool       `json:"is_reachable"`
	LastSeen    *time.Time `json:"last_seen"`
}

type CreateClusterRequest struct {
	Name    string              `json:"name"`
	Routers []CreateRouterInput `json:"routers"`
}

type CreateRouterInput struct {
	Name     string `json:"name"`
	Hostname string `json:"hostname"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type UpdateClusterRequest struct {
	Name    string              `json:"name"`
	Routers []UpdateRouterInput `json:"routers"`
}

type UpdateRouterInput struct {
	ID       string `json:"id,omitempty"`
	Name     string `json:"name"`
	Hostname string `json:"hostname"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type TestConnectionRequest struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type TestConnectionResponse struct {
	Success         bool   `json:"success"`
	RouterOSVersion string `json:"routeros_version,omitempty"`
	BoardName       string `json:"board_name,omitempty"`
	Error           string `json:"error,omitempty"`
}
