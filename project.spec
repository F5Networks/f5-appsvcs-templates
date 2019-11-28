Summary: %{_name} %{_version}
Name: %{_name}
Version: %{_version}
Release: %{_release}
BuildArch: noarch
License: Commercial
Group: Development/Tools

%description
Framework for deploying configuration on BIG-IP using mustache templates

%define INSTALL_DIR /var/config/rest/iapps/%{name}

%prep
mkdir -p %{_builddir}
echo -n %{version}-%{release} > %{_builddir}/version
cp -r %{main}/src/* %{_builddir}
cp -r %{main}/node_modules %{_builddir}

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT%{INSTALL_DIR}
cp -r %{_builddir}/* $RPM_BUILD_ROOT%{INSTALL_DIR}

%clean rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root)
%{INSTALL_DIR}
